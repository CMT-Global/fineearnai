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

    // Check if user is admin (admins bypass rate limiting)
    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    const isAdmin = !!adminRole;

    // Rate limiting: Max 10 withdrawal requests per hour (skipped for admins)
    if (!isAdmin) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentRequests, error: rateLimitError } = await supabase
        .from('withdrawal_requests')
        .select('id')
        .eq('user_id', user.id)
        .gte('created_at', oneHourAgo);

      if (!rateLimitError && recentRequests && recentRequests.length >= 10) {
        console.log('Rate limit exceeded:', { userId: user.id, requestCount: recentRequests.length });
        return new Response(JSON.stringify({ 
          error: 'Rate limit exceeded. Maximum 10 withdrawal requests per hour.',
          retryAfter: 3600 // seconds
        }), {
          status: 429,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': '3600'
          }
        });
      }
    } else {
      console.log('Rate limit bypassed for admin user:', user.id);
    }

    const { amount, payoutAddress, paymentMethod, paymentProcessorId } = await req.json();

    console.log('Processing withdrawal request:', { userId: user.id, amount, paymentMethod, paymentProcessorId });

    // Get user profile and membership plan (including daily withdrawal bypass flag)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*, membership_plan, allow_daily_withdrawals, email_verified')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found:', profileError);
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PHASE 5.d: Check email verification status (admins bypass this check)
    if (!isAdmin && !profile.email_verified) {
      console.log('Withdrawal blocked: Email not verified', { userId: user.id, email: profile.email });
      return new Response(JSON.stringify({ 
        error: 'Email verification required',
        message: 'Please verify your email address before requesting a withdrawal. Check your inbox for the verification code.',
        errorCode: 'EMAIL_NOT_VERIFIED'
      }), {
        status: 403,
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

    // Parse withdrawal amount first for validation and fee calculation
    const withdrawalAmount = parseFloat(amount);
    
    // Get withdrawal fees from payment processor configuration
    let feeFixed = 0;
    let feePercentage = 0;
    
    if (paymentProcessorId) {
      console.log('Fetching fees for processor:', paymentProcessorId);
      
      const { data: processorConfig, error: processorError } = await supabase
        .from('payment_processors')
        .select('fee_fixed, fee_percentage, name')
        .eq('id', paymentProcessorId)
        .eq('is_active', true)
        .single();
      
      if (processorError || !processorConfig) {
        console.error('Error fetching processor config:', processorError);
        return new Response(JSON.stringify({ error: 'Invalid payment processor' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      feeFixed = parseFloat(String(processorConfig.fee_fixed)) || 0;
      feePercentage = parseFloat(String(processorConfig.fee_percentage)) || 0;
      
      console.log('Processor fees loaded:', { 
        processor: processorConfig.name,
        feeFixed, 
        feePercentage,
        totalFeeForAmount: feeFixed + (withdrawalAmount * feePercentage / 100)
      });
    } else {
      // Processor ID is required - no fallback
      console.error('Payment processor ID is required');
      return new Response(JSON.stringify({ 
        error: 'Payment processor selection is required for withdrawals' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // PHASE 2: Check if user has daily withdrawal bypass enabled
    // This allows VIP users to bypass payout schedule restrictions
    const allowDailyWithdrawals = profile.allow_daily_withdrawals || false;

    if (!allowDailyWithdrawals) {
      // Standard users: Check if withdrawal is currently allowed (using time-aware schedule)
      console.log('Checking withdrawal schedule for user:', user.id);
      
      const { data: isAllowed, error: scheduleError } = await supabase
        .rpc('is_withdrawal_allowed');

      if (scheduleError) {
        console.error('Error checking withdrawal schedule:', scheduleError);
        
        // Log validation failure
        await supabase.from('withdrawal_attempt_logs').insert({
          user_id: user.id,
          amount: withdrawalAmount,
          attempt_status: 'error',
          failure_reason: 'Schedule validation error: ' + scheduleError.message,
        });
        
        return new Response(
          JSON.stringify({ error: 'Failed to validate withdrawal schedule' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (!isAllowed) {
        console.log('Withdrawal blocked by schedule:', { 
          userId: user.id, 
          amount: withdrawalAmount,
          timestamp: new Date().toISOString() 
        });
        
        // Get next available withdrawal window
        const { data: nextWindowData } = await supabase
          .rpc('get_next_withdrawal_window')
          .single();
        
        const nextWindow = nextWindowData as {
          next_day: string;
          next_date: string;
          start_time: string;
          end_time: string;
          hours_until: number;
        } | null;
        
        // Get current UTC day and time for logging
        const { data: currentDay } = await supabase.rpc('get_current_utc_day');
        const { data: currentTime } = await supabase.rpc('get_current_utc_time');
        
        // Log blocked attempt
        await supabase.from('withdrawal_attempt_logs').insert({
          user_id: user.id,
          amount: withdrawalAmount,
          attempt_status: 'blocked_schedule',
          failure_reason: 'Withdrawal attempted outside allowed schedule',
          blocked_by_schedule: true,
          current_day: currentDay as number,
          current_time: currentTime as string,
        });
        
        // Get schedule details for error message
        const { data: scheduleConfig } = await supabase
          .from('platform_config')
          .select('value')
          .eq('key', 'payout_schedule')
          .single();

        let errorMessage = 'Withdrawals are not allowed at this time';
        let nextWindowMessage = '';
        
        if (nextWindow) {
          const hoursText = nextWindow.hours_until === 1 ? 'hour' : 'hours';
          nextWindowMessage = `\n\nNext available: ${nextWindow.next_day}, ${nextWindow.next_date} at ${nextWindow.start_time}-${nextWindow.end_time} UTC (in ${nextWindow.hours_until} ${hoursText})`;
        }
        
        if (scheduleConfig && scheduleConfig.value) {
          const schedule = scheduleConfig.value as Array<{
            day: number;
            enabled: boolean;
            start_time: string;
            end_time: string;
          }>;
          
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const enabledDays = schedule
            .filter(s => s.enabled)
            .map(s => `${dayNames[s.day]} (${s.start_time}-${s.end_time} UTC)`)
            .join(', ');
          
          if (enabledDays) {
            errorMessage = `Withdrawals are only allowed during: ${enabledDays}${nextWindowMessage}`;
          }
        }
        
        return new Response(
          JSON.stringify({ 
            error: errorMessage,
            code: 'WITHDRAWAL_TIME_RESTRICTED',
            nextWindow: nextWindow || null
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    } else {
      // VIP users with daily withdrawal bypass: Skip schedule check entirely
      console.log('✅ BYPASS ACTIVE: User has daily withdrawal bypass enabled:', {
        userId: user.id,
        username: profile.username,
        amount: withdrawalAmount,
        timestamp: new Date().toISOString()
      });
      
      // Log bypass usage for audit trail
      await supabase.from('withdrawal_attempt_logs').insert({
        user_id: user.id,
        amount: withdrawalAmount,
        attempt_status: 'bypass_used',
        failure_reason: 'VIP bypass - schedule check skipped',
      });
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
      // Log limit violation
      await supabase.from('withdrawal_attempt_logs').insert({
        user_id: user.id,
        amount: withdrawalAmount,
        attempt_status: 'blocked_limit',
        failure_reason: `Daily limit exceeded: ${totalWithdrawnToday + withdrawalAmount} > ${maxDailyWithdrawal}`,
      });
      
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
      // Log insufficient balance attempt
      await supabase.from('withdrawal_attempt_logs').insert({
        user_id: user.id,
        amount: withdrawalAmount,
        attempt_status: 'blocked_balance',
        failure_reason: `Insufficient balance: requested ${withdrawalAmount}, available ${currentBalance}`,
      });
      
      return new Response(JSON.stringify({ error: 'Insufficient balance' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate fee and net amount (fixed fee + percentage fee)
    const percentageFee = (withdrawalAmount * feePercentage) / 100;
    const fee = feeFixed + percentageFee;
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
        p_payment_processor_id: paymentProcessorId || null,
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
    
    // Log successful withdrawal request
    await supabase.from('withdrawal_attempt_logs').insert({
      user_id: user.id,
      amount: withdrawalAmount,
      attempt_status: 'success',
      failure_reason: null,
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
