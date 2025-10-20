import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ============================================================================
  // PHASE 1: ENHANCED LOGGING & PERFORMANCE TRACKING
  // ============================================================================
  const requestStartTime = Date.now();
  const requestId = crypto.randomUUID();
  let userId: string | undefined;
  let taskId: string | undefined;
  let metricSuccess = false;

  console.log(`🚀 [${requestId}] Task submission started at ${new Date().toISOString()}`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authStartTime = Date.now();
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error(`❌ [${requestId}] No authorization header provided`);
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error(`❌ [${requestId}] Authentication failed:`, authError?.message);
      throw new Error('Unauthorized');
    }

    userId = user.id;
    const authTime = Date.now() - authStartTime;
    console.log(`✅ [${requestId}] User authenticated: ${userId} (${authTime}ms)`);

    const { taskId: submittedTaskId, selectedResponse, timeTakenSeconds } = await req.json();
    taskId = submittedTaskId;

    console.log(`📝 [${requestId}] Task submission details:`, {
      userId,
      taskId,
      selectedResponse,
      timeTakenSeconds
    });

    // ============================================================================
    // PHASE 5: ENHANCED INPUT VALIDATION
    // ============================================================================
    if (!taskId || !selectedResponse || timeTakenSeconds === undefined) {
      return new Response(
        JSON.stringify({ 
          error: 'validation_error',
          message: 'Missing required fields: taskId, selectedResponse, or timeTakenSeconds' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    if (!['a', 'b'].includes(selectedResponse)) {
      return new Response(
        JSON.stringify({ 
          error: 'validation_error',
          message: 'Invalid response selection. Must be "a" or "b"' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    if (typeof timeTakenSeconds !== 'number' || timeTakenSeconds < 0) {
      return new Response(
        JSON.stringify({ 
          error: 'validation_error',
          message: 'Invalid timeTakenSeconds value' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // ============================================================================
    // PHASE 1.2: OPTIMIZED DATA FETCHING WITH BASIC VALIDATION
    // ============================================================================
    
    // Fetch user profile for quick validation
    const profileStartTime = Date.now();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      const profileTime = Date.now() - profileStartTime;
      console.error(`❌ [${requestId}] Profile fetch error (${profileTime}ms):`, profileError);
      return new Response(
        JSON.stringify({ 
          error: 'profile_not_found',
          message: 'User profile not found' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }

    // Fetch membership plan separately (no FK relationship exists)
    const { data: membershipPlan, error: planError } = await supabase
      .from('membership_plans')
      .select('*')
      .eq('name', profile.membership_plan)
      .eq('is_active', true)
      .maybeSingle();

    const profileTime = Date.now() - profileStartTime;

    if (planError || !membershipPlan) {
      console.error(`❌ [${requestId}] Membership plan fetch error (${profileTime}ms):`, planError);
      return new Response(
        JSON.stringify({ 
          error: 'plan_not_found',
          message: `Membership plan '${profile.membership_plan}' not found or inactive` 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }

    console.log(`📊 [${requestId}] Profile loaded (${profileTime}ms):`, {
      username: profile.username,
      plan: profile.membership_plan,
      tasksCompleted: profile.tasks_completed_today,
      dailyLimit: membershipPlan.daily_task_limit
    });

    // Fast-fail validation checks (before calling atomic function)
    if (profile.account_status !== 'active') {
      return new Response(
        JSON.stringify({ 
          error: 'account_inactive',
          message: `Account is ${profile.account_status}. Please contact support.`,
          accountStatus: profile.account_status
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    // Check membership plan expiry
    if (profile.plan_expires_at) {
      const expiryDate = new Date(profile.plan_expires_at);
      if (expiryDate < new Date()) {
        return new Response(
          JSON.stringify({ 
            error: 'plan_expired',
            message: 'Your membership plan has expired. Please upgrade to continue.',
            planExpiresAt: profile.plan_expires_at
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          }
        );
      }
    }

    // Get task details for calculating earnings
    const { data: task, error: taskError } = await supabase
      .from('ai_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('is_active', true)
      .maybeSingle();

    if (taskError || !task) {
      console.error(`❌ [${requestId}] Task fetch error:`, taskError);
      return new Response(
        JSON.stringify({ 
          error: 'task_not_found',
          message: 'Task not found or is no longer active' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }

    // ============================================================================
    // PHASE 1.2: ATOMIC TASK COMPLETION (SINGLE DATABASE TRANSACTION)
    // ============================================================================
    
    const processingStartTime = Date.now();
    
    // Calculate correctness and earnings
    const isCorrect = selectedResponse === task.correct_response;
    const earningsAmount = isCorrect ? membershipPlan.earning_per_task : 0;

    console.log(`${isCorrect ? '✅' : '❌'} [${requestId}] Answer ${isCorrect ? 'correct' : 'incorrect'}. Earnings: $${earningsAmount}`);

    // Call atomic database function - everything happens in ONE transaction
    const { data: result, error: atomicError } = await supabase
      .rpc('complete_task_atomic', {
        p_user_id: user.id,
        p_task_id: taskId,
        p_selected_response: selectedResponse,
        p_time_taken_seconds: timeTakenSeconds,
        p_is_correct: isCorrect,
        p_earnings_amount: earningsAmount
      });

    const processingTime = Date.now() - processingStartTime;
    
    if (atomicError) {
      console.error(`❌ [${requestId}] Atomic task completion failed (${processingTime}ms):`, atomicError);
      return new Response(
        JSON.stringify({ 
          error: 'task_completion_failed',
          message: 'Failed to complete task. Please try again.',
          details: atomicError.message
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // Check if atomic operation succeeded
    if (!result || !result.success) {
      const errorCode = result?.error_code || 'UNKNOWN_ERROR';
      const errorMessage = result?.error || 'Task completion failed';
      
      console.error(`❌ [${requestId}] Atomic operation failed (${processingTime}ms):`, { errorCode, errorMessage });

      // Map error codes to HTTP status codes
      let statusCode = 500;
      if (errorCode === 'DAILY_LIMIT_REACHED') statusCode = 429;
      else if (errorCode === 'DUPLICATE_SUBMISSION') statusCode = 409;
      else if (errorCode === 'PROFILE_NOT_FOUND' || errorCode === 'INVALID_TASK') statusCode = 404;
      else if (errorCode === 'INVALID_PLAN') statusCode = 403;

      return new Response(
        JSON.stringify({ 
          error: errorCode.toLowerCase(),
          message: errorMessage,
          ...result
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: statusCode,
        }
      );
    }

    console.log(`✅ [${requestId}] Atomic task completion succeeded (${processingTime}ms):`, {
      tasksCompleted: result.tasks_completed_today,
      remainingTasks: result.remaining_tasks,
      newBalance: result.new_earnings_balance
    });

    // Queue referral commission if user was referred (async processing)
    if (profile.referred_by && earningsAmount > 0) {
      const { data: referrer, error: referrerError } = await supabase
        .from('profiles')
        .select('id, membership_plan')
        .eq('id', profile.referred_by)
        .maybeSingle();

      if (!referrerError && referrer) {
        // Fetch referrer's membership plan
        const { data: referrerPlan, error: planError } = await supabase
          .from('membership_plans')
          .select('task_commission_rate')
          .eq('name', referrer.membership_plan)
          .eq('is_active', true)
          .maybeSingle();

        if (!planError && referrerPlan && referrerPlan.task_commission_rate > 0) {
          // Queue commission for async processing (non-blocking)
          const { error: queueError } = await supabase
            .from('commission_queue')
            .insert({
              referrer_id: referrer.id,
              referred_user_id: user.id,
              event_type: 'task',
              amount: earningsAmount,
              commission_rate: referrerPlan.task_commission_rate / 100,
              metadata: {
                task_id: taskId,
                category: task.category,
                username: profile.username
              }
            });

          if (queueError) {
            console.error(`⚠️ [${requestId}] Error queueing task commission:`, queueError);
            // Don't block user response - log and continue
          } else {
            console.log(`💰 [${requestId}] Task commission queued:`, { referrerId: referrer.id, amount: earningsAmount, rate: referrerPlan.task_commission_rate });
          }
        }
      }
    }

    // ============================================================================
    // PHASE 1: PERFORMANCE METRICS RECORDING
    // ============================================================================
    
    const totalExecutionTime = Date.now() - requestStartTime;
    metricSuccess = true;

    // ============================================================================
    // PHASE 1: INVALIDATE USER STATS CACHE IN GET-NEXT-TASK
    // ============================================================================
    
    // Invalidate cache immediately after task completion
    const cacheInvalidationStartTime = Date.now();
    try {
      // Call get-next-task to trigger cache invalidation
      const invalidationResponse = await fetch(`${supabaseUrl}/functions/v1/invalidate-user-cache`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id })
      });
      
      const cacheInvalidationTime = Date.now() - cacheInvalidationStartTime;
      if (!invalidationResponse.ok) {
        console.warn(`⚠️ [${requestId}] Cache invalidation warning (${cacheInvalidationTime}ms): Response not OK`);
      } else {
        console.log(`🗑️ [${requestId}] User stats cache invalidated (${cacheInvalidationTime}ms)`);
      }
    } catch (cacheError: any) {
      const cacheInvalidationTime = Date.now() - cacheInvalidationStartTime;
      console.warn(`⚠️ [${requestId}] Cache invalidation failed (${cacheInvalidationTime}ms):`, cacheError.message);
      // Don't block response - cache will expire naturally in 5 seconds
    }

    console.log(`✅ [${requestId}] Task completion successful. Total time: ${totalExecutionTime}ms`, {
      userId,
      taskId,
      isCorrect,
      earnings: earningsAmount,
      newBalance: result.new_earnings_balance,
      executionBreakdown: {
        authentication: authTime,
        profile_fetch: profileTime,
        atomic_transaction: processingTime,
        total: totalExecutionTime
      }
    });

    // Record performance metrics (non-blocking)
    supabase
      .from('edge_function_metrics')
      .insert({
        function_name: 'complete-ai-task',
        execution_time_ms: totalExecutionTime,
        success: true,
        user_id: userId,
        metadata: {
          task_id: taskId,
          is_correct: isCorrect,
          earnings_amount: earningsAmount,
          time_taken_seconds: timeTakenSeconds,
          auth_time_ms: authTime,
          profile_time_ms: profileTime,
          atomic_transaction_ms: processingTime
        }
      })
      .then(({ error }) => {
        if (error) {
          console.error(`⚠️ [${requestId}] Failed to record metrics:`, error);
        }
      });
    
    // ============================================================================
    // PHASE 1.2: COMPREHENSIVE RESPONSE WITH ATOMIC RESULT DATA
    // ============================================================================
    
    return new Response(
      JSON.stringify({
        success: true,
        isCorrect,
        correctAnswer: task.correct_response,
        earnedAmount: earningsAmount,
        newBalance: result.new_earnings_balance,
        tasksCompletedToday: result.tasks_completed_today,
        dailyLimit: result.daily_task_limit,
        remainingTasks: result.remaining_tasks,
        totalEarned: result.new_total_earned,
        taskCategory: task.category,
        taskDifficulty: task.difficulty,
        timeTaken: timeTakenSeconds,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    // ============================================================================
    // PHASE 1: ENHANCED ERROR HANDLING & LOGGING WITH METRICS
    // ============================================================================
    const totalExecutionTime = Date.now() - requestStartTime;

    console.error(`💥 [${requestId}] Fatal error in complete-ai-task (${totalExecutionTime}ms):`, {
      userId: userId || 'unknown',
      taskId: taskId || 'unknown',
      errorMessage: error.message,
      errorCode: error.code,
      errorName: error.name,
      stack: error.stack,
    });

    // Record error metrics (non-blocking)
    if (userId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      supabase
        .from('edge_function_metrics')
        .insert({
          function_name: 'complete-ai-task',
          execution_time_ms: totalExecutionTime,
          success: false,
          error_message: error.message,
          user_id: userId,
          metadata: {
            task_id: taskId,
            error_code: error.code,
            error_name: error.name
          }
        })
        .then(({ error: metricError }) => {
          if (metricError) {
            console.error(`⚠️ [${requestId}] Failed to record error metrics:`, metricError);
          }
        });
    }

    return new Response(
      JSON.stringify({ 
        error: 'internal_error',
        message: error.message || 'An unexpected error occurred while processing your submission',
        code: error.code || 'UNKNOWN',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});