import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log(`Fetching referrer info for user ${user.id}`);

    // Get current user's profile to find their referrer
    const { data: currentUser, error: userError } = await supabaseClient
      .from('profiles')
      .select('id, referred_by, username, email')
      .eq('id', user.id)
      .maybeSingle();

    if (userError || !currentUser) {
      console.error('Error fetching user profile:', userError);
      throw new Error('Failed to fetch user profile');
    }

    // Check if user has a referrer
    if (!currentUser.referred_by) {
      console.log('User has no referrer');
      return new Response(
        JSON.stringify({
          success: true,
          hasReferrer: false,
          message: 'You joined directly without a referral'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get referrer's profile (sanitized - no sensitive data)
    const { data: referrer, error: referrerError } = await supabaseClient
      .from('profiles')
      .select('id, username, email, full_name, membership_plan, created_at')
      .eq('id', currentUser.referred_by)
      .maybeSingle();

    if (referrerError || !referrer) {
      console.error('Error fetching referrer:', referrerError);
      throw new Error('Failed to fetch referrer information');
    }

    // Get referral relationship details
    const { data: referralDetails, error: referralError } = await supabaseClient
      .from('referrals')
      .select('referral_code_used, total_commission_earned, last_commission_date, created_at, status')
      .eq('referrer_id', referrer.id)
      .eq('referred_id', user.id)
      .maybeSingle();

    if (referralError) {
      console.error('Error fetching referral details:', referralError);
      // Don't throw, just log - we can still return basic referrer info
    }

    // Get referrer's membership plan details
    const { data: membershipPlan, error: planError } = await supabaseClient
      .from('membership_plans')
      .select('display_name, task_commission_rate, deposit_commission_rate')
      .eq('name', referrer.membership_plan)
      .eq('is_active', true)
      .maybeSingle();

    if (planError) {
      console.error('Error fetching membership plan:', planError);
      // Don't throw, just log
    }

    console.log(`Found referrer ${referrer.id} for user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        hasReferrer: true,
        referrer: {
          id: referrer.id,
          username: referrer.username,
          fullName: referrer.full_name,
          email: referrer.email,
          membershipPlan: membershipPlan?.display_name || referrer.membership_plan,
          joinedAt: referrer.created_at,
          commissionRates: membershipPlan ? {
            taskCommission: membershipPlan.task_commission_rate,
            depositCommission: membershipPlan.deposit_commission_rate
          } : null
        },
        relationship: referralDetails ? {
          referralCode: referralDetails.referral_code_used,
          totalCommissionEarned: Number(referralDetails.total_commission_earned || 0),
          lastCommissionDate: referralDetails.last_commission_date,
          joinedViaReferralAt: referralDetails.created_at,
          status: referralDetails.status
        } : null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in get-referrer-info:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: error.message === 'Unauthorized' ? 401 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
