import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { amount, paymentMethod, gatewayTransactionId } = await req.json();

    console.log('Processing deposit:', { userId: user.id, amount, paymentMethod });

    // Validate amount
    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid deposit amount' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*, membership_plan')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found:', profileError);
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const depositAmount = parseFloat(amount);
    const newBalance = parseFloat(profile.deposit_wallet_balance) + depositAmount;

    // Update profile balance
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ deposit_wallet_balance: newBalance })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating balance:', updateError);
      throw updateError;
    }

    // Create transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'deposit',
        amount: depositAmount,
        wallet_type: 'deposit',
        new_balance: newBalance,
        description: `Deposit via ${paymentMethod}`,
        status: 'completed',
        payment_gateway: paymentMethod,
        gateway_transaction_id: gatewayTransactionId,
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
      throw transactionError;
    }

    // Handle referral commission on deposit if user was referred
    if (profile.referred_by) {
      // Get referrer's profile WITH their membership plan
      const { data: referrerProfile } = await supabase
        .from('profiles')
        .select('earnings_wallet_balance, membership_plan')
        .eq('id', profile.referred_by)
        .single();

      if (referrerProfile) {
        // Get referrer's membership plan to use THEIR commission rate
        const { data: referrerPlan } = await supabase
          .from('membership_plans')
          .select('*')
          .eq('name', referrerProfile.membership_plan)
          .single();

        if (referrerPlan && referrerPlan.deposit_commission_rate > 0) {
          const commissionAmount = depositAmount * (referrerPlan.deposit_commission_rate / 100);
          const newReferrerBalance = parseFloat(referrerProfile.earnings_wallet_balance) + commissionAmount;

          // Update referrer's balance
          await supabase
            .from('profiles')
            .update({ earnings_wallet_balance: newReferrerBalance })
            .eq('id', profile.referred_by);

          // Record referral earning
          await supabase
            .from('referral_earnings')
            .insert({
              referrer_id: profile.referred_by,
              referred_user_id: user.id,
              earning_type: 'deposit_commission',
              base_amount: depositAmount,
              commission_amount: commissionAmount,
              commission_rate: referrerPlan.deposit_commission_rate,
              metadata: {
                transaction_id: transaction.id,
              },
            });

          // Create transaction for referrer
          await supabase
            .from('transactions')
            .insert({
              user_id: profile.referred_by,
              type: 'referral_commission',
              amount: commissionAmount,
              wallet_type: 'earnings',
              new_balance: newReferrerBalance,
              description: `Referral commission from ${profile.username}'s deposit`,
              status: 'completed',
              metadata: {
                referred_user_id: user.id,
                deposit_transaction_id: transaction.id,
              },
            });

          console.log('Deposit referral commission paid:', { referrerId: profile.referred_by, amount: commissionAmount, referrerPlan: referrerPlan.name });
        }
      }
    }

    console.log('Deposit completed successfully:', { userId: user.id, amount: depositAmount });

    return new Response(
      JSON.stringify({
        success: true,
        transaction,
        newBalance,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in deposit function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
