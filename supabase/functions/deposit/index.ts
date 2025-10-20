import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { getMembershipPlan } from '../_shared/cache.ts';

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

    // CRITICAL: Insert transaction BEFORE updating profile balance
    // The validate_transaction_balance trigger checks if new_balance matches
    // current_balance + amount. If we update profile first, validation fails.
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

    // Now update profile balance AFTER transaction is recorded
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ deposit_wallet_balance: newBalance })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating balance:', updateError);
      throw updateError;
    }

    // Queue referral commission on deposit if user was referred (async processing)
    if (profile.referred_by) {
      // Get referrer's membership plan to check THEIR commission rate
      const { data: referrerProfile } = await supabase
        .from('profiles')
        .select('id, membership_plan')
        .eq('id', profile.referred_by)
        .single();

      if (referrerProfile) {
        const referrerPlan = await getMembershipPlan(supabase, referrerProfile.membership_plan);

        if (referrerPlan && referrerPlan.deposit_commission_rate > 0) {
          // Queue commission for async processing (non-blocking)
          const { error: queueError } = await supabase
            .from('commission_queue')
            .insert({
              referrer_id: profile.referred_by,
              referred_user_id: user.id,
              event_type: 'deposit',
              amount: depositAmount,
              commission_rate: referrerPlan.deposit_commission_rate / 100,
              metadata: {
                transaction_id: transaction.id,
                username: profile.username
              }
            });

          if (queueError) {
            console.error('Error queueing deposit commission:', queueError);
            // Don't block user response - log and continue
          } else {
            console.log('Deposit commission queued:', { referrerId: profile.referred_by, amount: depositAmount, referrerPlan: referrerProfile.membership_plan });
          }
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
