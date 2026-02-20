import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { getMembershipPlan } from '../_shared/cache.ts';
import { sendTemplateEmail } from '../_shared/email-sender.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const authHeader = req.headers.get('Authorization');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const { planName } = await req.json();
    console.log('Processing plan upgrade:', {
      userId: user.id,
      planName
    });
    // Validate plan name
    if (!planName || typeof planName !== 'string') {
      return new Response(JSON.stringify({
        error: 'Invalid plan name'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get user profile
    const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profileError || !profile) {
      console.error('Profile not found:', profileError);
      return new Response(JSON.stringify({
        error: 'Profile not found'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Check if user is trying to downgrade or already on this plan
    if (profile.membership_plan === planName) {
      return new Response(JSON.stringify({
        error: 'You are already on this plan'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get the current plan details (fallback to default if profile has stale plan name)
    const currentPlan = profile.membership_plan
      ? await getMembershipPlan(supabase, profile.membership_plan, { fallbackToDefault: true })
      : null;
    // Get the new plan details using cache
    const newPlan = await getMembershipPlan(supabase, planName);
    if (!newPlan || !newPlan.is_active) {
      console.error('Plan not found or inactive:', planName);
      return new Response(JSON.stringify({
        error: 'Invalid or inactive membership plan'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // ✅ CRITICAL: Server-side downgrade prevention
    if (currentPlan && parseFloat(currentPlan.price) > 0) {
      const currentPrice = parseFloat(currentPlan.price);
      const newPrice = parseFloat(newPlan.price);
      if (newPrice < currentPrice) {
        console.error('❌ Downgrade attempt blocked:', {
          userId: user.id,
          currentPlan: currentPlan.name,
          currentPrice,
          targetPlan: planName,
          targetPrice: newPrice
        });
        return new Response(JSON.stringify({
          error: 'Cannot downgrade to a cheaper plan',
          code: 'DOWNGRADE_NOT_ALLOWED',
          currentPlan: currentPlan.display_name,
          currentPrice: currentPrice,
          targetPlan: newPlan.display_name,
          targetPrice: newPrice
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      console.log('✅ Price validation passed: upgrade allowed', {
        currentPrice,
        newPrice,
        difference: newPrice - currentPrice
      });
    }
    // Explicit default (free tier) plan downgrade block (extra safety)
    const isDefaultPlan = (newPlan.account_type || '').toLowerCase().trim() === 'free';
    if (isDefaultPlan && currentPlan && parseFloat(currentPlan.price) > 0) {
      console.error('❌ Downgrade to default plan blocked');
      return new Response(JSON.stringify({
        error: 'Cannot downgrade to the default plan. Please contact support.',
        code: 'DEFAULT_PLAN_DOWNGRADE_NOT_ALLOWED'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    let finalCost = parseFloat(newPlan.price);
    let prorationDetails = null;
    // Calculate proration ONLY for genuine upgrades (newPrice > currentPrice); skip if current plan is default tier
    const isCurrentPlanDefaultTier = currentPlan && (currentPlan.account_type || '').toLowerCase().trim() === 'free';
    if (currentPlan && profile.current_plan_start_date && parseFloat(currentPlan.price) > 0 && !isCurrentPlanDefaultTier && parseFloat(newPlan.price) > parseFloat(currentPlan.price)) {
      console.log('Calculating proration for upgrade from paid plan');
      // Call the database function to calculate proration
      const { data: proration, error: prorationError } = await supabase.rpc('calculate_proration', {
        p_current_plan_price: parseFloat(currentPlan.price),
        p_current_plan_start_date: profile.current_plan_start_date,
        p_current_plan_billing_days: currentPlan.billing_period_days,
        p_new_plan_price: parseFloat(newPlan.price)
      });
      if (!prorationError && proration) {
        prorationDetails = proration;
        finalCost = parseFloat(proration.new_cost);
        console.log('Proration calculated:', {
          originalPrice: proration.original_price,
          credit: proration.credit,
          finalCost: finalCost,
          savings: proration.savings
        });
      } else {
        console.error('Error calculating proration:', prorationError);
      }
    }
    // Check if user has sufficient balance in deposit wallet
    const depositBalance = parseFloat(profile.deposit_wallet_balance);
    if (depositBalance < finalCost) {
      return new Response(JSON.stringify({
        error: 'Insufficient balance in deposit wallet',
        required: finalCost,
        current: depositBalance,
        shortfall: finalCost - depositBalance
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Calculate new balance
    const newDepositBalance = depositBalance - finalCost;
    // Calculate plan expiry date using billing_period_days as single source of truth
    const expiryDate = new Date();
    const billingPeriodDays = newPlan.billing_period_days;
    if (!billingPeriodDays || billingPeriodDays <= 0) {
      throw new Error(`Invalid billing_period_days for plan ${planName}: ${billingPeriodDays}`);
    }
    // ALWAYS use billing_period_days - no fallbacks, no unit conversions
    expiryDate.setDate(expiryDate.getDate() + billingPeriodDays);
    console.log(`✅ Expiry calculation: Plan=${planName}, billing_period_days=${billingPeriodDays}, expiry=${expiryDate.toISOString()}`);
    const now = new Date().toISOString();
    // ============================================================================
    // PHASE 1: USE ATOMIC FUNCTION TO PROCESS UPGRADE + COMMISSION
    // ============================================================================
    console.log('Calling atomic plan upgrade function:', {
      userId: user.id,
      planName,
      finalCost,
      expiryDate: expiryDate.toISOString()
    });
    const { data: atomicResult, error: atomicError } = await supabase.rpc('process_plan_upgrade_atomic', {
      p_user_id: user.id,
      p_plan_name: planName,
      p_final_cost: finalCost,
      p_expiry_date: expiryDate.toISOString(),
      p_previous_plan: profile.membership_plan,
      p_metadata: {
        previous_plan: profile.membership_plan,
        previous_plan_display_name: currentPlan?.display_name || profile.membership_plan,
        new_plan: planName,
        new_plan_display_name: newPlan.display_name,
        original_price: parseFloat(newPlan.price),
        final_price: finalCost,
        proration_applied: prorationDetails !== null,
        proration_details: prorationDetails,
        billing_period_days: billingPeriodDays,
        billing_period_unit: newPlan.billing_period_unit,
        billing_period_value: newPlan.billing_period_value,
        expires_at: expiryDate.toISOString(),
        upgraded_at: now,
        tasks_preserved: true,
        tasks_completed_at_upgrade: profile.tasks_completed_today,
        skips_used_at_upgrade: profile.skips_today
      }
    });
    if (atomicError) {
      console.error('❌ Atomic plan upgrade failed:', atomicError);
      throw new Error('Failed to process plan upgrade atomically: ' + atomicError.message);
    }
    if (!atomicResult.success) {
      console.error('❌ Atomic plan upgrade returned error:', atomicResult);
      throw new Error(atomicResult.error || 'Plan upgrade processing failed');
    }
    console.log('✅ Atomic plan upgrade successful:', {
      transactionId: atomicResult.transaction_id,
      newBalance: atomicResult.new_deposit_balance
    });
    // Restore account_status to 'active' when user was expired (so task APIs allow access again)
    await supabase.from('profiles').update({ account_status: 'active' }).eq('id', user.id).eq('account_status', 'expired');
    // Stop trial reactivation email sequence when user upgrades
    await supabase.from('trial_reactivation_sequence').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('user_id', user.id).eq('status', 'active');
    // Log to user activity log
    await supabase.from('user_activity_log').insert({
      user_id: user.id,
      activity_type: 'plan_upgrade',
      details: {
        from_plan: profile.membership_plan,
        to_plan: planName,
        amount_paid: finalCost,
        proration_applied: prorationDetails !== null,
        savings: prorationDetails?.savings || 0
      }
    });
    // Send plan upgrade notification (if notifications table exists)
    try {
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Plan Upgraded Successfully',
        message: `You have successfully upgraded to ${newPlan.display_name}. Your plan expires on ${new Date(expiryDate).toLocaleDateString()}.`,
        type: 'plan_upgrade',
        metadata: {
          plan_name: planName,
          expires_at: expiryDate.toISOString(),
          amount_paid: finalCost
        }
      });
    } catch (notifError) {
      console.log('Note: Could not create notification (table may not exist):', notifError);
    }
    // Send plan upgrade success email when campaign is enabled (non-blocking)
    const { data: campaignConfig } = await supabase.from('platform_config').select('value').eq('key', 'upgrade_success_email_campaign').maybeSingle();
    const campaignEnabled = (campaignConfig?.value as { enabled?: boolean } | null)?.enabled === true;
    if (campaignEnabled) {
      const { data: userProfile } = await supabase.from('profiles').select('email, username, full_name, referral_code').eq('id', user.id).single();
      if (userProfile?.email) {
        const [{ data: configRows }, { data: taskCommissionsRow }] = await Promise.all([
          supabase.from('platform_config').select('key, value').in('key', ['platform_branding', 'email_settings']),
          supabase.from('referral_earnings').select('commission_amount').eq('referrer_id', user.id).eq('earning_type', 'task_commission')
        ]);
        const branding = (configRows?.find((r: { key: string }) => r.key === 'platform_branding')?.value as { name?: string; url?: string }) || {};
        const emailSettings = (configRows?.find((r: { key: string }) => r.key === 'email_settings')?.value as { platform_url?: string; support_email?: string }) || {};
        const platformUrl = branding?.url || emailSettings?.platform_url || 'https://profitchips.com';
        const platformName = branding?.name || 'ProfitChips';
        const supportEmail = emailSettings?.support_email || 'support@profitchips.com';
        const loginUrl = `${platformUrl.replace(/\/$/, '')}/login`;
        const membershipUrl = `${platformUrl.replace(/\/$/, '')}/app/plans`;
        const teamInviteLink = userProfile.referral_code
          ? `${platformUrl.replace(/\/$/, '')}/signup?ref=${encodeURIComponent(userProfile.referral_code)}`
          : `${platformUrl.replace(/\/$/, '')}/referrals`;
        const taskCommissionsTotal = (taskCommissionsRow || []).reduce((sum: number, r: { commission_amount: number }) => sum + Number(r.commission_amount || 0), 0);
        const taskCommissionsFormatted = typeof taskCommissionsTotal === 'number' && !Number.isNaN(taskCommissionsTotal)
          ? `$${taskCommissionsTotal.toFixed(2)}`
          : '$0.00';
        const firstName = (userProfile.full_name || userProfile.username || 'there').split(/\s+/)[0] || 'there';
        sendTemplateEmail({
          templateType: 'account_upgrade_success',
          recipientEmail: userProfile.email,
          recipientUserId: user.id,
          variables: {
            first_name: firstName,
            login_url: loginUrl,
            new_plan_name: newPlan.display_name,
            team_invite_link: teamInviteLink,
            membership_url: membershipUrl,
            support_email: supportEmail,
            platform_name: platformName,
            task_commissions_earned: taskCommissionsFormatted
          },
          supabaseClient: supabase
        }).catch((err) => console.warn('⚠️ Upgrade success email failed:', err));
      }
    }
    // Enroll in post-upgrade team commissions sequence on first upgrade only; send Email 1 (Day 0) immediately (non-blocking)
    try {
      const { data: teamCommissionsConfig } = await supabase.from('platform_config').select('value').eq('key', 'post_upgrade_team_commissions_campaign').maybeSingle();
      const teamCommissionsEnabled = (teamCommissionsConfig?.value as { enabled?: boolean } | null)?.enabled === true;
      if (teamCommissionsEnabled) {
        const { count, error: countErr } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'plan_upgrade');
        if (!countErr && count === 1) {
          const upgradedAt = new Date().toISOString();
          await supabase.from('post_upgrade_team_commissions_enrollment').upsert(
            {
              user_id: user.id,
              upgraded_at: upgradedAt,
              status: 'active',
              current_step: 0,
              updated_at: upgradedAt
            },
            { onConflict: 'user_id', ignoreDuplicates: true }
          );
          // Send Email 1 (Day 0) immediately after upgrade
          const { data: enrollProfile } = await supabase.from('profiles').select('email, full_name, username, referral_code').eq('id', user.id).single();
          if (enrollProfile?.email && enrollProfile.email.includes('@')) {
            const { data: configRows } = await supabase.from('platform_config').select('key, value').in('key', ['platform_branding', 'email_settings']);
            const branding = (configRows?.find((r: { key: string }) => r.key === 'platform_branding')?.value as { name?: string; url?: string }) || {};
            const emailSettings = (configRows?.find((r: { key: string }) => r.key === 'email_settings')?.value as { platform_url?: string }) || {};
            const platformUrl = (branding?.url || emailSettings?.platform_url || 'https://profitchips.com').replace(/\/$/, '');
            const teamGuideUrl = `${platformUrl}/how-it-works`;
            const teamInviteUrl = enrollProfile.referral_code ? `${platformUrl}/signup?ref=${encodeURIComponent(enrollProfile.referral_code)}` : `${platformUrl}/referrals`;
            const firstName = ((enrollProfile.full_name || enrollProfile.username || 'there').trim().split(/\s+/)[0]) || 'there';
            sendTemplateEmail({
              templateType: 'post_upgrade_team_1',
              recipientEmail: enrollProfile.email,
              recipientUserId: user.id,
              variables: { first_name: firstName, team_invite_url: teamInviteUrl, team_guide_url: teamGuideUrl },
              supabaseClient: supabase
            }).then(async (result) => {
              if (result.success) {
                const nowIso = new Date().toISOString();
                await supabase.from('post_upgrade_team_commissions_enrollment').update({
                  current_step: 1,
                  last_sent_at: nowIso,
                  step_sent_map: { '1': nowIso },
                  updated_at: nowIso
                }).eq('user_id', user.id);
              }
            }).catch((err) => console.warn('⚠️ Post-upgrade team commissions Email 1 (Day 0) failed:', err));
          }
        }
      }
    } catch (enrollErr) {
      console.warn('⚠️ Post-upgrade team commissions enrollment skip/failed:', enrollErr);
    }
    console.log('Plan upgraded successfully:', {
      userId: user.id,
      planName,
      finalCost,
      prorationApplied: prorationDetails !== null,
      expiryDate
    });
    return new Response(JSON.stringify({
      success: true,
      plan: newPlan.display_name,
      planName: planName,
      expiresAt: expiryDate.toISOString(),
      newBalance: newDepositBalance,
      amountCharged: finalCost,
      originalPrice: parseFloat(newPlan.price),
      prorationApplied: prorationDetails !== null,
      prorationDetails: prorationDetails ? {
        credit: prorationDetails.credit,
        savings: prorationDetails.savings,
        daysRemaining: prorationDetails.days_remaining
      } : null
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in upgrade-plan function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
