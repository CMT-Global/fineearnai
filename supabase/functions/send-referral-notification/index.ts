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

    // Send referral email (main task)
    console.log('[REFERRAL-NOTIFICATION] 📧 Sending referral email to:', referrerProfile.email);
    
    const emailResult = await sendTemplateEmail({
      templateType: 'referral',
      recipientEmail: referrerProfile.email,
      recipientUserId: referrer_id,
      variables: {
        username: referrerProfile.username,
        email: referrerProfile.email,
        referred_username: referred_username,
        referred_email: referred_email,
        referral_code: referral_code,
        signup_date: new Date().toLocaleString('en-US', { 
          timeZone: 'UTC',
          dateStyle: 'full',
          timeStyle: 'long'
        }),
        task_commission_rate: referrerPlan?.task_commission_rate 
          ? (referrerPlan.task_commission_rate * 100).toFixed(0)
          : '0',
        deposit_commission_rate: referrerPlan?.deposit_commission_rate 
          ? (referrerPlan.deposit_commission_rate * 100).toFixed(0)
          : '0',
        total_referrals: totalReferrals.toString(),
        total_commission: totalCommission.toFixed(2)
      },
      supabaseClient: supabase
    });

    if (emailResult.success) {
      console.log('[REFERRAL-NOTIFICATION] ✅ Email sent successfully. Message ID:', emailResult.messageId);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Referral notification sent successfully',
          email_message_id: emailResult.messageId,
          email_log_id: emailResult.emailLogId
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      console.error('[REFERRAL-NOTIFICATION] ❌ Email failed:', emailResult.error);
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Email sending failed',
          details: emailResult.error
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

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
