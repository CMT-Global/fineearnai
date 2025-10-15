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
    // PHASE 5: OPTIMIZED DATA FETCHING WITH VALIDATION
    // ============================================================================
    
    // Fetch user profile
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

    // Check account status
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

    // Check if task already completed (prevent duplicate submissions)
    const { data: existingCompletion } = await supabase
      .from('task_completions')
      .select('id')
      .eq('user_id', user.id)
      .eq('task_id', taskId)
      .maybeSingle();

    if (existingCompletion) {
      return new Response(
        JSON.stringify({ 
          error: 'duplicate_submission',
          message: 'This task has already been completed' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409,
        }
      );
    }

    // Check daily task limit
    if (profile.tasks_completed_today >= membershipPlan.daily_task_limit) {
      return new Response(
        JSON.stringify({ 
          error: 'daily_limit_reached',
          message: 'Daily task limit reached. Upgrade your plan to complete more tasks.',
          tasksCompletedToday: profile.tasks_completed_today,
          dailyLimit: membershipPlan.daily_task_limit
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429,
        }
      );
    }

    // Get task details with validation
    const { data: task, error: taskError } = await supabase
      .from('ai_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('is_active', true)
      .maybeSingle();

    if (taskError) {
      console.error('Task fetch error:', taskError);
      return new Response(
        JSON.stringify({ 
          error: 'task_fetch_error',
          message: 'Failed to fetch task details' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    if (!task) {
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
    // PHASE 5: ATOMIC TRANSACTION FOR TASK COMPLETION
    // ============================================================================
    
    const processingStartTime = Date.now();
    
    // Check if answer is correct
    const isCorrect = selectedResponse === task.correct_response;
    const earningsAmount = isCorrect ? membershipPlan.earning_per_task : 0;

    console.log(`${isCorrect ? '✅' : '❌'} [${requestId}] Answer ${isCorrect ? 'correct' : 'incorrect'}. Earnings: $${earningsAmount}`);

    // Calculate new values
    const newEarningsBalance = Number(profile.earnings_wallet_balance) + earningsAmount;
    const newTotalEarned = Number(profile.total_earned) + earningsAmount;
    const newTasksCompleted = profile.tasks_completed_today + 1;
    const todayDate = new Date().toISOString().split('T')[0];

    // Insert task completion record
    const insertStartTime = Date.now();
    const { error: completionError } = await supabase
      .from('task_completions')
      .insert({
        user_id: user.id,
        task_id: taskId,
        selected_response: selectedResponse,
        is_correct: isCorrect,
        earnings_amount: earningsAmount,
        time_taken_seconds: timeTakenSeconds,
      });

    const insertTime = Date.now() - insertStartTime;
    console.log(`💾 [${requestId}] Task completion inserted (${insertTime}ms)`);

    if (completionError) {
      console.error('Completion insert error:', completionError);
      
      // Check if duplicate key error
      if (completionError.code === '23505') {
        return new Response(
          JSON.stringify({ 
            error: 'duplicate_submission',
            message: 'This task has already been completed' 
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 409,
          }
        );
      }

      return new Response(
        JSON.stringify({ 
          error: 'submission_failed',
          message: 'Failed to record task completion' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // Update user profile with optimistic locking
    const updateStartTime = Date.now();
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        earnings_wallet_balance: newEarningsBalance,
        total_earned: newTotalEarned,
        tasks_completed_today: newTasksCompleted,
        last_task_date: todayDate,
        last_activity: new Date().toISOString(),
      })
      .eq('id', user.id)
      .eq('tasks_completed_today', profile.tasks_completed_today); // Optimistic lock

    const updateTime = Date.now() - updateStartTime;
    console.log(`🔄 [${requestId}] Profile updated (${updateTime}ms)`);

    if (updateError) {
      console.error('Profile update error:', updateError);
      
      // If optimistic lock failed, task was likely submitted concurrently
      if (updateError.code === 'PGRST116') {
        return new Response(
          JSON.stringify({ 
            error: 'concurrent_submission',
            message: 'Please wait a moment before submitting another task' 
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 409,
          }
        );
      }

      return new Response(
        JSON.stringify({ 
          error: 'update_failed',
          message: 'Failed to update user profile' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // Create transaction record if earned
    if (earningsAmount > 0) {
      await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'task_earning',
          amount: earningsAmount,
          wallet_type: 'earnings',
          new_balance: newEarningsBalance,
          description: `AI Task completed: ${task.category}`,
          status: 'completed',
          metadata: {
            task_id: taskId,
            category: task.category,
            difficulty: task.difficulty,
            time_taken_seconds: timeTakenSeconds,
          },
        });

      // Queue referral commission if user was referred (async processing)
      if (profile.referred_by && earningsAmount > 0) {
        const { data: referrer } = await supabase
          .from('profiles')
          .select('id, membership_plan')
          .eq('id', profile.referred_by)
          .single();

        if (referrer) {
          // Fetch referrer's membership plan
          const { data: referrerPlan } = await supabase
            .from('membership_plans')
            .select('task_commission_rate')
            .eq('name', referrer.membership_plan)
            .eq('is_active', true)
            .maybeSingle();

          if (referrerPlan && referrerPlan.task_commission_rate > 0) {
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
    }

    // ============================================================================
    // PHASE 1: PERFORMANCE METRICS RECORDING
    // ============================================================================
    
    const totalExecutionTime = Date.now() - requestStartTime;
    metricSuccess = true;

    console.log(`✅ [${requestId}] Task completion successful. Total time: ${totalExecutionTime}ms`, {
      userId,
      taskId,
      isCorrect,
      earnings: earningsAmount,
      newBalance: newEarningsBalance,
      executionBreakdown: {
        authentication: authTime,
        profile_fetch: profileTime,
        task_insert: insertTime,
        profile_update: updateTime,
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
          insert_time_ms: insertTime,
          update_time_ms: updateTime
        }
      })
      .then(({ error }) => {
        if (error) {
          console.error(`⚠️ [${requestId}] Failed to record metrics:`, error);
        }
      });
    
    // ============================================================================
    // PHASE 5: COMPREHENSIVE RESPONSE WITH NEXT TASK DATA
    // ============================================================================
    
    // Optionally preload next task for faster UX (commented out for now to avoid complexity)
    // This can be enabled in future optimization
    
    return new Response(
      JSON.stringify({
        success: true,
        isCorrect,
        correctAnswer: task.correct_response,
        earnedAmount: earningsAmount,
        newBalance: newEarningsBalance,
        tasksCompletedToday: newTasksCompleted,
        dailyLimit: membershipPlan.daily_task_limit,
        remainingTasks: membershipPlan.daily_task_limit - newTasksCompleted,
        totalEarned: newTotalEarned,
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