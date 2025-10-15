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

    if (!taskId || !selectedResponse || timeTakenSeconds === undefined) {
      throw new Error('Missing required fields');
    }

    if (!['a', 'b'].includes(selectedResponse)) {
      throw new Error('Invalid response selection');
    }

    // Get user profile and membership plan
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*, membership_plans!inner(*)')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found');
    }

    // Check if task already completed
    const { data: existingCompletion } = await supabase
      .from('task_completions')
      .select('id')
      .eq('user_id', user.id)
      .eq('task_id', taskId)
      .maybeSingle();

    if (existingCompletion) {
      throw new Error('Task already completed');
    }

    // Check daily task limit
    if (profile.tasks_completed_today >= profile.membership_plans.daily_task_limit) {
      throw new Error('Daily task limit reached');
    }

    // Get task details
    const { data: task, error: taskError } = await supabase
      .from('ai_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('is_active', true)
      .single();

    if (taskError || !task) {
      throw new Error('Task not found or inactive');
    }

    // Check if answer is correct
    const isCorrect = selectedResponse === task.correct_response;
    const earningsAmount = isCorrect ? profile.membership_plans.earning_per_task : 0;

    // Insert task completion
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
      throw completionError;
    }

    // Update user profile
    const newEarningsBalance = Number(profile.earnings_wallet_balance) + earningsAmount;
    const newTasksCompleted = profile.tasks_completed_today + 1;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        earnings_wallet_balance: newEarningsBalance,
        tasks_completed_today: newTasksCompleted,
        last_task_date: new Date().toISOString().split('T')[0],
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Profile update error:', updateError);
      throw updateError;
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

    return new Response(
      JSON.stringify({
        success: true,
        isCorrect,
        correctAnswer: task.correct_response,
        earnedAmount: earningsAmount,
        newBalance: newEarningsBalance,
        tasksCompletedToday: newTasksCompleted,
        dailyLimit: profile.membership_plans.daily_task_limit,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in complete-ai-task:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});