import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface LinkReferrerRequest {
  userId: string;
  referralCode: string;
}

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

    const { userId, referralCode }: LinkReferrerRequest = await req.json();

    console.log(`Linking user ${userId} to referrer with code: ${referralCode}`);

    // Validate inputs
    if (!userId || !referralCode) {
      throw new Error('Missing required fields: userId and referralCode');
    }

    // Validate referral code format (8 alphanumeric characters)
    if (!/^[A-Z0-9]{8}$/.test(referralCode)) {
      throw new Error('Invalid referral code format');
    }

    // Get the user being referred
    const { data: referredUser, error: userError } = await supabaseClient
      .from('profiles')
      .select('id, username, email, referred_by, referral_code, account_status')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !referredUser) {
      console.error('Error fetching user:', userError);
      throw new Error('User not found');
    }

    // Check if user is already linked to a referrer
    if (referredUser.referred_by) {
      console.log('User already has a referrer, skipping');
      return new Response(
        JSON.stringify({ success: true, message: 'User already has a referrer' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent self-referral
    if (referredUser.referral_code === referralCode) {
      throw new Error('You cannot use your own referral code');
    }

    // Find the referrer by referral code
    const { data: referrer, error: referrerError } = await supabaseClient
      .from('profiles')
      .select('id, username, email, referral_code, account_status, membership_plan')
      .eq('referral_code', referralCode)
      .maybeSingle();

    if (referrerError || !referrer) {
      console.error('Error fetching referrer:', referrerError);
      throw new Error('Invalid referral code - referrer not found');
    }

    // Check if referrer account is active
    if (referrer.account_status !== 'active') {
      throw new Error('Referrer account is not active');
    }

    // Prevent circular referrals (check if referrer was referred by this user)
    const { data: circularCheck } = await supabaseClient
      .from('profiles')
      .select('referred_by')
      .eq('id', referrer.id)
      .maybeSingle();

    if (circularCheck && circularCheck.referred_by === userId) {
      throw new Error('Circular referral detected - referrer was referred by this user');
    }

    // Check if a referral relationship already exists (edge case)
    const { data: existingReferral } = await supabaseClient
      .from('referrals')
      .select('id')
      .eq('referrer_id', referrer.id)
      .eq('referred_id', userId)
      .maybeSingle();

    if (existingReferral) {
      console.log('Referral relationship already exists');
      return new Response(
        JSON.stringify({ success: true, message: 'Referral already exists' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create referral relationship record
    const { error: referralError } = await supabaseClient
      .from('referrals')
      .insert({
        referrer_id: referrer.id,
        referred_id: userId,
        referral_code_used: referralCode,
        status: 'active',
        total_commission_earned: 0
      });

    if (referralError) {
      console.error('Error creating referral record:', referralError);
      throw new Error(`Failed to create referral: ${referralError.message}`);
    }

    // Update referred user's referred_by field
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ referred_by: referrer.id })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating user referred_by:', updateError);
      throw new Error(`Failed to update user: ${updateError.message}`);
    }

    // Get referral program config to check for signup bonus
    const { data: config } = await supabaseClient
      .from('referral_program_config')
      .select('signup_bonus_enabled, signup_bonus_amount')
      .maybeSingle();

    let signupBonusApplied = false;
    let signupBonusAmount = 0;

    // Process signup bonus if enabled
    if (config && config.signup_bonus_enabled && config.signup_bonus_amount > 0) {
      signupBonusAmount = Number(config.signup_bonus_amount);
      
      const { data: currentBalance } = await supabaseClient
        .from('profiles')
        .select('deposit_wallet_balance')
        .eq('id', userId)
        .maybeSingle();

      const newBalance = Number(currentBalance?.deposit_wallet_balance || 0) + signupBonusAmount;

      // Credit signup bonus to referred user's deposit wallet
      const { error: bonusError } = await supabaseClient
        .from('profiles')
        .update({ deposit_wallet_balance: newBalance })
        .eq('id', userId);

      if (!bonusError) {
        // Create transaction record for signup bonus
        await supabaseClient
          .from('transactions')
          .insert({
            user_id: userId,
            type: 'deposit',
            amount: signupBonusAmount,
            wallet_type: 'deposit',
            status: 'completed',
            new_balance: newBalance,
            description: 'Signup bonus from referral',
            metadata: {
              referrer_id: referrer.id,
              referral_code: referralCode,
              bonus_type: 'signup'
            }
          });

        signupBonusApplied = true;
        console.log(`Applied signup bonus of $${signupBonusAmount} to new user`);
      }
    }

    // Log user activity
    await supabaseClient
      .from('user_activity_log')
      .insert({
        user_id: userId,
        activity_type: 'referral_signup',
        details: {
          referrer_id: referrer.id,
          referral_code: referralCode,
          signup_bonus_applied: signupBonusApplied,
          signup_bonus_amount: signupBonusAmount
        }
      });

    // Send notification to referrer about new signup
    try {
      await supabaseClient.from('notifications').insert({
        user_id: referrer.id,
        title: 'New Referral Signup',
        message: `${referredUser.username || referredUser.email} joined using your referral link!`,
        type: 'referral_signup',
        metadata: {
          referred_user_id: userId,
          referral_code: referralCode
        }
      });
    } catch (notifError) {
      console.log('Note: Could not create notification (table may not exist):', notifError);
    }

    console.log(`Successfully linked user ${userId} to referrer ${referrer.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        referrer: {
          id: referrer.id,
          username: referrer.username,
          email: referrer.email
        },
        signupBonus: signupBonusApplied ? {
          applied: true,
          amount: signupBonusAmount
        } : null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in link-user-to-referrer:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
