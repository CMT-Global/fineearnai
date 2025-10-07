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

      // Handle referral commission if user was referred
      if (profile.referred_by) {
        const { data: referrer } = await supabase
          .from('profiles')
          .select('*, membership_plans!inner(*)')
          .eq('id', profile.referred_by)
          .single();

        if (referrer && referrer.membership_plans.task_commission_rate > 0) {
          const commissionAmount = earningsAmount * (referrer.membership_plans.task_commission_rate / 100);
          const newReferrerBalance = Number(referrer.earnings_wallet_balance) + commissionAmount;

          // Update referrer balance
          await supabase
            .from('profiles')
            .update({ earnings_wallet_balance: newReferrerBalance })
            .eq('id', referrer.id);

          // Create referral earning record
          await supabase
            .from('referral_earnings')
            .insert({
              referrer_id: referrer.id,
              referred_user_id: user.id,
              earning_type: 'task_commission',
              base_amount: earningsAmount,
              commission_rate: referrer.membership_plans.task_commission_rate,
              commission_amount: commissionAmount,
              metadata: {
                task_id: taskId,
                category: task.category,
              },
            });

          // Create transaction for referrer
          await supabase
            .from('transactions')
            .insert({
              user_id: referrer.id,
              type: 'referral_commission',
              amount: commissionAmount,
              wallet_type: 'earnings',
              new_balance: newReferrerBalance,
              description: `Referral commission from ${profile.username}'s task`,
              status: 'completed',
            });
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