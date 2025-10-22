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

    // Get membership plan details using cache
    const plan = await getMembershipPlan(supabase, profile.membership_plan);

    if (!plan) {
      console.error('Plan not found:', profile.membership_plan);
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

    // Check minimum withdrawal (convert string to number)
    const minWithdrawal = parseFloat(plan.min_withdrawal as string);
    if (withdrawalAmount < minWithdrawal) {
      return new Response(
        JSON.stringify({ error: `Minimum withdrawal is ${minWithdrawal}` }),
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

    const maxDailyWithdrawal = parseFloat(plan.max_daily_withdrawal as string);
    if (totalWithdrawnToday + withdrawalAmount > maxDailyWithdrawal) {
      return new Response(
        JSON.stringify({ 
          error: `Daily withdrawal limit exceeded. You can withdraw up to ${maxDailyWithdrawal - totalWithdrawnToday} more today.`
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

    // Check for existing pending withdrawal request (prevent duplicates)
    const { data: pendingCheck, error: pendingError } = await supabase
      .from('withdrawal_requests')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (pendingError) {
      console.error('Error checking pending withdrawals:', pendingError);
    }

    if (pendingCheck) {
      return new Response(
        JSON.stringify({ 
          error: 'You already have a pending withdrawal request. Please wait for it to be processed.' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Use atomic database function to process withdrawal request
    // This eliminates race conditions and ensures all-or-nothing operation
    const { data: result, error: atomicError } = await supabase.rpc(
      'process_withdrawal_request_atomic',
      {
        p_user_id: user.id,
        p_amount: withdrawalAmount,
        p_fee: fee,
        p_net_amount: netAmount,
        p_payout_address: payoutAddress,
        p_payment_method: paymentMethod,
        p_payment_processor_id: null, // Can be added later if needed
      }
    );

    if (atomicError) {
      console.error('Error calling atomic withdrawal function:', atomicError);
      return new Response(
        JSON.stringify({ error: 'Failed to process withdrawal request' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if the atomic operation was successful
    if (!result || !result.success) {
      const errorMessage = result?.error || 'Failed to create withdrawal request';
      const errorCode = result?.error_code || 'UNKNOWN_ERROR';
      
      console.error('Atomic withdrawal failed:', { errorCode, errorMessage, userId: user.id });
      
      return new Response(
        JSON.stringify({ error: errorMessage, code: errorCode }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Withdrawal request created successfully (atomic):', { 
      userId: user.id, 
      amount: withdrawalAmount,
      withdrawalRequestId: result.withdrawal_request_id,
      transactionId: result.transaction_id
    });

    // Prepare withdrawal request object for response
    const withdrawalRequest = {
      id: result.withdrawal_request_id,
      user_id: user.id,
      amount: withdrawalAmount,
      fee: fee,
      net_amount: netAmount,
      payout_address: payoutAddress,
      payment_method: paymentMethod,
      status: 'pending',
    };

    const newBalance = result.new_balance;

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
