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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { taskId, selectedResponse, timeTakenSeconds } = await req.json();

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
    
    // Fetch user profile and membership plan
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*, membership_plans!inner(*)')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
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
    if (profile.tasks_completed_today >= (profile.membership_plans as any).daily_task_limit) {
      return new Response(
        JSON.stringify({ 
          error: 'daily_limit_reached',
          message: 'Daily task limit reached. Upgrade your plan to complete more tasks.',
          tasksCompletedToday: profile.tasks_completed_today,
          dailyLimit: (profile.membership_plans as any).daily_task_limit
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
    
    // Check if answer is correct
    const isCorrect = selectedResponse === task.correct_response;
    const earningsAmount = isCorrect ? (profile.membership_plans as any).earning_per_task : 0;

    // Calculate new values
    const newEarningsBalance = Number(profile.earnings_wallet_balance) + earningsAmount;
    const newTotalEarned = Number(profile.total_earned) + earningsAmount;
    const newTasksCompleted = profile.tasks_completed_today + 1;
    const todayDate = new Date().toISOString().split('T')[0];

    // Insert task completion record
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
          .select('id, membership_plans!inner(task_commission_rate)')
          .eq('id', profile.referred_by)
          .single();

        if (referrer && referrer.membership_plans && (referrer.membership_plans as any).task_commission_rate > 0) {
          // Queue commission for async processing (non-blocking)
          const { error: queueError } = await supabase
            .from('commission_queue')
            .insert({
              referrer_id: referrer.id,
              referred_user_id: user.id,
              event_type: 'task',
              amount: earningsAmount,
              commission_rate: (referrer.membership_plans as any).task_commission_rate / 100,
              metadata: {
                task_id: taskId,
                category: task.category,
                username: profile.username
              }
            });

          if (queueError) {
            console.error('Error queueing task commission:', queueError);
            // Don't block user response - log and continue
          } else {
            console.log('Task commission queued:', { referrerId: referrer.id, amount: earningsAmount });
          }
        }
      }
    }

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
        dailyLimit: (profile.membership_plans as any).daily_task_limit,
        remainingTasks: (profile.membership_plans as any).daily_task_limit - newTasksCompleted,
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
    // PHASE 5: ENHANCED ERROR HANDLING & LOGGING
    // ============================================================================
    console.error('Unexpected error in complete-ai-task:', {
      userId: error.userId || 'unknown',
      taskId: error.taskId || 'unknown',
      errorMessage: error.message,
      errorCode: error.code,
      stack: error.stack,
    });

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