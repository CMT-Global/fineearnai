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

    const { amount, payoutAddress, paymentMethod } = await req.json();

    console.log('Processing withdrawal request:', { userId: user.id, amount, paymentMethod });

    // Get user profile and membership plan
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

    // Get membership plan details
    const { data: plan, error: planError } = await supabase
      .from('membership_plans')
      .select('*')
      .eq('name', profile.membership_plan)
      .single();

    if (planError || !plan) {
      console.error('Plan not found:', planError);
      return new Response(JSON.stringify({ error: 'Membership plan not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get withdrawal fee percentage from platform config
    const { data: feeConfig } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'withdrawal_fee_percentage')
      .single();

    const feePercentage = feeConfig ? parseFloat(feeConfig.value as string) : 2;

    const withdrawalAmount = parseFloat(amount);

    // Validate withdrawal amount
    if (!withdrawalAmount || withdrawalAmount <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid withdrawal amount' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check minimum withdrawal
    if (withdrawalAmount < plan.min_withdrawal) {
      return new Response(
        JSON.stringify({ error: `Minimum withdrawal is ${plan.min_withdrawal}` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check payout schedule
    const { data: payoutDaysConfig } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'payout_days')
      .single();

    if (payoutDaysConfig) {
      const payoutDays = payoutDaysConfig.value as number[];
      const today = new Date().getDay();
      
      if (!payoutDays.includes(today)) {
        return new Response(
          JSON.stringify({ 
            error: 'Withdrawals are only allowed on scheduled payout days',
            payoutDays 
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Check daily withdrawal limits
    const today = new Date().toISOString().split('T')[0];
    const { data: todayWithdrawals } = await supabase
      .from('withdrawal_requests')
      .select('amount')
      .eq('user_id', user.id)
      .gte('created_at', today)
      .in('status', ['pending', 'approved', 'processing', 'completed']);

    const totalWithdrawnToday = todayWithdrawals?.reduce(
      (sum, t) => sum + parseFloat(t.amount),
      0
    ) || 0;

    if (totalWithdrawnToday + withdrawalAmount > plan.max_daily_withdrawal) {
      return new Response(
        JSON.stringify({ 
          error: `Daily withdrawal limit exceeded. You can withdraw up to ${plan.max_daily_withdrawal - totalWithdrawnToday} more today.` 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check sufficient balance
    const currentBalance = parseFloat(profile.earnings_wallet_balance);
    if (currentBalance < withdrawalAmount) {
      return new Response(JSON.stringify({ error: 'Insufficient balance' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate fee and net amount
    const fee = (withdrawalAmount * feePercentage) / 100;
    const netAmount = withdrawalAmount - fee;

    // Deduct from earnings wallet
    const newBalance = currentBalance - withdrawalAmount;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ earnings_wallet_balance: newBalance })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating balance:', updateError);
      throw updateError;
    }

    // Create withdrawal request
    const { data: withdrawalRequest, error: requestError } = await supabase
      .from('withdrawal_requests')
      .insert({
        user_id: user.id,
        amount: withdrawalAmount,
        net_amount: netAmount,
        fee: fee,
        payout_address: payoutAddress,
        payment_method: paymentMethod,
        status: 'pending',
      })
      .select()
      .single();

    if (requestError) {
      console.error('Error creating withdrawal request:', requestError);
      // Rollback balance change
      await supabase
        .from('profiles')
        .update({ earnings_wallet_balance: currentBalance })
        .eq('id', user.id);
      throw requestError;
    }

    // Create transaction record
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'withdrawal',
        amount: withdrawalAmount,
        wallet_type: 'earnings',
        new_balance: newBalance,
        description: `Withdrawal request via ${paymentMethod}`,
        status: 'pending',
        payment_gateway: paymentMethod,
        metadata: {
          withdrawal_request_id: withdrawalRequest.id,
          payout_address: payoutAddress,
          fee: fee,
          net_amount: netAmount,
        },
      });

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
    }

    console.log('Withdrawal request created successfully:', { userId: user.id, amount: withdrawalAmount });

    return new Response(
      JSON.stringify({
        success: true,
        withdrawalRequest,
        newBalance,
        message: 'Withdrawal request submitted. Pending admin approval.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in request-withdrawal function:', error);
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
