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

    const { userTaskId, submissionData } = await req.json();

    console.log('Completing task:', { userTaskId, userId: user.id });

    // Get user task details
    const { data: userTask, error: taskError } = await supabase
      .from('user_tasks')
      .select('*, task:tasks(*)')
      .eq('id', userTaskId)
      .eq('user_id', user.id)
      .single();

    if (taskError || !userTask) {
      console.error('Task not found:', taskError);
      return new Response(JSON.stringify({ error: 'Task not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (userTask.status !== 'in_progress' && userTask.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'Task already completed or expired' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // Check if user has reached daily task limit
    if (profile.tasks_completed_today >= plan.daily_task_limit) {
      return new Response(JSON.stringify({ error: 'Daily task limit reached' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate earnings based on membership plan
    const earnedAmount = plan.earning_per_task;
    const newEarningsBalance = parseFloat(profile.earnings_wallet_balance) + earnedAmount;
    const newTasksCompleted = profile.tasks_completed_today + 1;

    // Update user task status
    const { error: updateTaskError } = await supabase
      .from('user_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        submission_data: submissionData || {},
        earned_amount: earnedAmount,
      })
      .eq('id', userTaskId);

    if (updateTaskError) {
      console.error('Error updating task:', updateTaskError);
      throw updateTaskError;
    }

    // Update profile
    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update({
        earnings_wallet_balance: newEarningsBalance,
        tasks_completed_today: newTasksCompleted,
        last_task_date: new Date().toISOString().split('T')[0],
      })
      .eq('id', user.id);

    if (updateProfileError) {
      console.error('Error updating profile:', updateProfileError);
      throw updateProfileError;
    }

    // Create transaction record
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'task_earning',
        amount: earnedAmount,
        wallet_type: 'earnings',
        new_balance: newEarningsBalance,
        description: `Completed task: ${userTask.task.title}`,
        status: 'completed',
        metadata: {
          task_id: userTask.task_id,
          user_task_id: userTaskId,
        },
      });

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
      throw transactionError;
    }

    console.log('Task completed successfully:', { userTaskId, earnedAmount });

    return new Response(
      JSON.stringify({
        success: true,
        earnedAmount,
        newBalance: newEarningsBalance,
        tasksCompletedToday: newTasksCompleted,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in complete-task function:', error);
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
