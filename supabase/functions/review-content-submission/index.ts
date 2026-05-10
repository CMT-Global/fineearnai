import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ── Verify admin ───────────────────────────────────────────────────────
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: { user: adminUser } } = await supabase.auth.getUser(token);
    if (!adminUser) throw new Error('Unauthorized');

    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', adminUser.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!adminRole) throw new Error('Admin access required');

    // ── Parse payload ──────────────────────────────────────────────────────
    const { submissionId, action, rewardAmount, rejectionReason } = await req.json();

    if (!submissionId || !action) throw new Error('Missing required fields: submissionId, action');
    if (!['approve', 'reject'].includes(action)) throw new Error('Invalid action. Must be "approve" or "reject"');
    if (action === 'approve' && (!rewardAmount || rewardAmount <= 0)) {
      throw new Error('rewardAmount must be a positive number for approval');
    }
    if (action === 'reject' && !rejectionReason?.trim()) {
      throw new Error('rejectionReason is required for rejection');
    }

    // ── Load submission + user profile ─────────────────────────────────────
    const { data: submission, error: subError } = await supabase
      .from('content_reward_submissions')
      .select('*, profiles:user_id(id, email, username, earnings_wallet_balance)')
      .eq('id', submissionId)
      .single();

    if (subError || !submission) throw new Error('Submission not found');
    if (submission.status !== 'pending') {
      throw new Error(`Submission is already "${submission.status}" — cannot update again`);
    }

    const now = new Date().toISOString();
    const userProfile = submission.profiles as any;
    const platformLabel = {
      tiktok: 'TikTok',
      youtube_shorts: 'YouTube Shorts',
      youtube_longform: 'YouTube Longform',
    }[submission.platform as string] ?? submission.platform;

    // ─────────────────────────────────────────────────────────────────────
    // APPROVE
    // ─────────────────────────────────────────────────────────────────────
    if (action === 'approve') {
      const reward = parseFloat(rewardAmount);

      // 1. Update submission record
      const { error: updateErr } = await supabase
        .from('content_reward_submissions')
        .update({
          status: 'approved',
          reward_amount: reward,
          reviewed_by: adminUser.id,
          reviewed_at: now,
        })
        .eq('id', submissionId);
      if (updateErr) throw updateErr;

      // 2. Credit earnings wallet
      const currentBalance = parseFloat(userProfile.earnings_wallet_balance ?? 0);
      const newBalance = currentBalance + reward;

      // Insert transaction first (mirrors adjust-wallet-balance pattern)
      const { error: txError } = await supabase.from('transactions').insert({
        user_id: submission.user_id,
        type: 'adjustment',
        wallet_type: 'earnings',
        amount: reward,
        new_balance: newBalance,
        status: 'completed',
        description: `Content Reward: ${submission.video_title || platformLabel} video`,
        metadata: {
          admin_id: adminUser.id,
          submission_id: submissionId,
          platform: submission.platform,
          action_type: 'content_reward',
        },
      });
      if (txError) throw txError;

      // Update profile balance
      const { error: balErr } = await supabase
        .from('profiles')
        .update({ earnings_wallet_balance: newBalance, last_activity: now })
        .eq('id', submission.user_id);
      if (balErr) throw balErr;

      // 3. In-app notification
      await supabase.from('notifications').insert({
        user_id: submission.user_id,
        title: '🎉 Content Reward Approved!',
        message: `Your ${platformLabel} video has been approved! US$${reward.toFixed(2)} has been credited to your Earnings Wallet.`,
        type: 'success',
        priority: 'high',
        metadata: { submission_id: submissionId, reward_amount: reward },
      });

      // 4. Email user (non-fatal — template may not exist yet)
      try {
        await supabase.functions.invoke('send-template-email', {
          body: {
            email: userProfile.email,
            template_type: 'content_reward_approved',
            variables: {
              username: userProfile.username ?? 'there',
              platform: platformLabel,
              video_title: submission.video_title ?? 'Your video',
              reward_amount: `US$${reward.toFixed(2)}`,
              video_url: submission.video_url,
            },
          },
        });
      } catch (emailErr) {
        console.warn('Email send skipped (template may not exist):', emailErr?.message);
      }

    // ─────────────────────────────────────────────────────────────────────
    // REJECT
    // ─────────────────────────────────────────────────────────────────────
    } else {
      // 1. Update submission record
      const { error: updateErr } = await supabase
        .from('content_reward_submissions')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason.trim(),
          reviewed_by: adminUser.id,
          reviewed_at: now,
        })
        .eq('id', submissionId);
      if (updateErr) throw updateErr;

      // 2. In-app notification
      await supabase.from('notifications').insert({
        user_id: submission.user_id,
        title: 'Content Submission Update',
        message: `Your ${platformLabel} video submission was not approved. Reason: ${rejectionReason.trim()}`,
        type: 'info',
        priority: 'medium',
        metadata: { submission_id: submissionId },
      });

      // 3. Email user (non-fatal)
      try {
        await supabase.functions.invoke('send-template-email', {
          body: {
            email: userProfile.email,
            template_type: 'content_reward_rejected',
            variables: {
              username: userProfile.username ?? 'there',
              platform: platformLabel,
              rejection_reason: rejectionReason.trim(),
            },
          },
        });
      } catch (emailErr) {
        console.warn('Email send skipped (template may not exist):', emailErr?.message);
      }
    }

    // ── Audit log ──────────────────────────────────────────────────────────
    await supabase.from('audit_logs').insert({
      admin_id: adminUser.id,
      action_type: `content_reward_${action}`,
      target_user_id: submission.user_id,
      details: {
        submission_id: submissionId,
        platform: submission.platform,
        action,
        reward_amount: action === 'approve' ? parseFloat(rewardAmount) : null,
        rejection_reason: action === 'reject' ? rejectionReason.trim() : null,
      },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[review-content-submission]', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
