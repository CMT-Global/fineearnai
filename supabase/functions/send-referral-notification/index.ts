import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTemplateEmail } from "../_shared/email-sender.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReferralNotificationRequest {
  referrer_id: string;
  referred_id: string;
  referred_username: string;
  referred_email: string;
  referral_code: string;
}

// Define milestone thresholds
const REFERRAL_MILESTONES = [5, 10, 25, 50, 100, 250, 500, 1000];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[REFERRAL-NOTIFICATION] Starting referral notification process');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const { 
      referrer_id, 
      referred_id, 
      referred_username, 
      referred_email, 
      referral_code 
    }: ReferralNotificationRequest = await req.json();

    console.log('[REFERRAL-NOTIFICATION] Processing:', {
      referrer_id,
      referred_id,
      referred_username,
      referral_code
    });

    // Fetch referrer's profile with plan details
    const { data: referrerProfile, error: referrerError } = await supabase
      .from('profiles')
      .select(`
        id,
        username,
        email,
        membership_plan,
        referral_code
      `)
      .eq('id', referrer_id)
      .single();

    if (referrerError || !referrerProfile) {
      console.error('[REFERRAL-NOTIFICATION] ❌ Referrer not found:', referrerError);
      throw new Error('Referrer profile not found');
    }

    console.log('[REFERRAL-NOTIFICATION] ✅ Referrer profile loaded:', referrerProfile.username);

    // Fetch referrer's membership plan details
    const { data: referrerPlan, error: planError } = await supabase
      .from('membership_plans')
      .select('task_commission_rate, deposit_commission_rate')
      .eq('name', referrerProfile.membership_plan)
      .single();

    if (planError || !referrerPlan) {
      console.error('[REFERRAL-NOTIFICATION] ⚠️ Plan not found, using defaults');
    }

    // Calculate total referrals and commission
    const { data: referralStats, error: statsError } = await supabase
      .from('referrals')
      .select('total_commission_earned')
      .eq('referrer_id', referrer_id);

    const totalReferrals = referralStats?.length || 0;
    const totalCommission = referralStats?.reduce(
      (sum, ref) => sum + (parseFloat(ref.total_commission_earned) || 0), 
      0
    ) || 0;

    console.log('[REFERRAL-NOTIFICATION] 📊 Stats:', {
      total_referrals: totalReferrals,
      total_commission: totalCommission
    });

    // Send in-app notification (fire-and-forget, non-blocking)
    (async () => {
      try {
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: referrer_id,
            type: 'referral',
            title: 'New Referral! 🎉',
            message: `${referred_username} just joined using your referral code! You'll earn commissions when they complete tasks and make deposits.`,
            priority: 'high',
            metadata: {
              referred_user_id: referred_id,
              referred_username: referred_username,
              referral_code: referral_code,
              signup_date: new Date().toISOString()
            }
          });
        
        if (notifError) {
          console.error('[REFERRAL-NOTIFICATION] ⚠️ Failed to create notification:', notifError);
        } else {
          console.log('[REFERRAL-NOTIFICATION] ✅ In-app notification created');
        }
      } catch (err) {
        console.error('[REFERRAL-NOTIFICATION] ⚠️ Notification error:', err);
      }
    })();

    // Send NEW referral signup email (main task)
    console.log('[REFERRAL-NOTIFICATION] 📧 Sending new referral signup email to:', referrerProfile.email);
    
    const emailResult = await sendTemplateEmail({
      templateType: 'new_referral_signup',
      recipientEmail: referrerProfile.email,
      recipientUserId: referrer_id,
      variables: {
        username: referrerProfile.username,
        referred_username: referred_username,
        referral_code: referral_code,
        total_referrals: totalReferrals.toString(),
        total_commission: totalCommission.toFixed(2),
        platform_url: supabaseUrl.replace('/supabase', '') || 'https://fineearn.com'
      },
      supabaseClient: supabase
    });

    if (emailResult.success) {
      console.log('[REFERRAL-NOTIFICATION] ✅ New referral email sent successfully. Message ID:', emailResult.messageId);
    } else {
      console.error('[REFERRAL-NOTIFICATION] ❌ Email failed:', emailResult.error);
    }

    // ============================================
    // PHASE 4: CHECK FOR REFERRAL MILESTONES
    // ============================================
    console.log('[MILESTONE-CHECK] Checking if milestone reached. Total referrals:', totalReferrals);
    
    let milestoneReached = false;
    let milestoneEmailSent = false;
    
    // Check if current total referrals matches any milestone
    if (REFERRAL_MILESTONES.includes(totalReferrals)) {
      console.log(`[MILESTONE-CHECK] 🎯 Milestone detected: ${totalReferrals} referrals!`);
      
      // Check if we already sent a milestone email for this exact count
      const { data: existingMilestone } = await supabase
        .from('email_logs')
        .select('id')
        .eq('recipient_user_id', referrer_id)
        .eq('subject', 'Referral Milestone Achieved!')
        .ilike('body', `%${totalReferrals}%`)
        .limit(1)
        .maybeSingle();
      
      if (existingMilestone) {
        console.log(`[MILESTONE-CHECK] ⏭️ Milestone email already sent for ${totalReferrals} referrals, skipping`);
      } else {
        // Send milestone congratulations email
        console.log(`[MILESTONE-CHECK] 📧 Sending milestone email for ${totalReferrals} referrals`);
        
        // Determine reward/bonus message based on milestone
        let rewardMessage = '';
        let nextMilestone = REFERRAL_MILESTONES.find(m => m > totalReferrals) || 0;
        
        if (totalReferrals >= 100) {
          rewardMessage = 'You\'re in the top tier of our referral program! Keep building your network!';
        } else if (totalReferrals >= 50) {
          rewardMessage = 'You\'re halfway to 100 referrals! Amazing progress!';
        } else if (totalReferrals >= 25) {
          rewardMessage = 'You\'re building an impressive network! Keep going!';
        } else if (totalReferrals >= 10) {
          rewardMessage = 'Double digits! You\'re on fire!';
        } else {
          rewardMessage = 'Great start! Keep sharing your referral link!';
        }
        
        const milestoneEmailResult = await sendTemplateEmail({
          templateType: 'referral_milestone',
          recipientEmail: referrerProfile.email,
          recipientUserId: referrer_id,
          variables: {
            username: referrerProfile.username,
            milestone_count: totalReferrals.toString(),
            total_commission: totalCommission.toFixed(2),
            reward_message: rewardMessage,
            next_milestone: nextMilestone > 0 ? nextMilestone.toString() : 'Keep growing!',
            referrals_to_next: nextMilestone > 0 ? (nextMilestone - totalReferrals).toString() : '0',
            platform_url: supabaseUrl.replace('/supabase', '') || 'https://fineearn.com'
          },
          supabaseClient: supabase
        });
        
        if (milestoneEmailResult.success) {
          console.log('[MILESTONE-CHECK] ✅ Milestone email sent successfully!');
          milestoneEmailSent = true;
          milestoneReached = true;
          
          // Create in-app notification for milestone
          await supabase.from('notifications').insert({
            user_id: referrer_id,
            type: 'referral_milestone',
            title: `🏆 Milestone: ${totalReferrals} Referrals!`,
            message: `Congratulations! You've reached ${totalReferrals} referrals and earned $${totalCommission.toFixed(2)} in commissions. ${rewardMessage}`,
            priority: 'high',
            metadata: {
              milestone_count: totalReferrals,
              total_commission: totalCommission,
              next_milestone: nextMilestone,
              achievement_date: new Date().toISOString()
            }
          });
          
          console.log('[MILESTONE-CHECK] ✅ Milestone notification created');
        } else {
          console.error('[MILESTONE-CHECK] ❌ Failed to send milestone email:', milestoneEmailResult.error);
        }
      }
    } else {
      console.log(`[MILESTONE-CHECK] No milestone at ${totalReferrals} referrals. Next milestone: ${REFERRAL_MILESTONES.find(m => m > totalReferrals) || 'N/A'}`);
    }

    // Return comprehensive response
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Referral notification sent successfully',
        email_message_id: emailResult.messageId,
        email_log_id: emailResult.emailLogId,
        total_referrals: totalReferrals,
        milestone_reached: milestoneReached,
        milestone_email_sent: milestoneEmailSent
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[REFERRAL-NOTIFICATION] ❌ Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Unknown error occurred'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
