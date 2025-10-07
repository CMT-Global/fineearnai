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

    // Handle referral commission if user was referred
    if (profile.referred_by && plan.task_commission_rate > 0) {
      const commissionAmount = earnedAmount * (plan.task_commission_rate / 100);
      
      // Get referrer's profile
      const { data: referrerProfile, error: referrerError } = await supabase
        .from('profiles')
        .select('*, membership_plan')
        .eq('id', profile.referred_by)
        .single();

      if (!referrerError && referrerProfile) {
        // Get referrer's membership plan
        const { data: referrerPlan } = await supabase
          .from('membership_plans')
          .select('*')
          .eq('name', referrerProfile.membership_plan)
          .single();

        if (referrerPlan && referrerPlan.task_commission_rate > 0) {
          // Check max active referrals limit
          const { count: activeReferralsCount } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('referred_by', profile.referred_by)
            .gte('tasks_completed_today', 1);

          const isWithinLimit = (activeReferralsCount || 0) <= referrerPlan.max_active_referrals;

          if (isWithinLimit) {
            const newReferrerBalance = parseFloat(referrerProfile.earnings_wallet_balance) + commissionAmount;

            // Update referrer's balance
            await supabase
              .from('profiles')
              .update({ earnings_wallet_balance: newReferrerBalance })
              .eq('id', profile.referred_by);

            // Record referral earning
            await supabase
              .from('referral_earnings')
              .insert({
                referrer_id: profile.referred_by,
                referred_user_id: user.id,
                earning_type: 'task_commission',
                base_amount: earnedAmount,
                commission_amount: commissionAmount,
                commission_rate: plan.task_commission_rate,
                metadata: {
                  task_id: userTask.task_id,
                  user_task_id: userTaskId,
                },
              });

            // Create transaction for referrer
            await supabase
              .from('transactions')
              .insert({
                user_id: profile.referred_by,
                type: 'referral_commission',
                amount: commissionAmount,
                wallet_type: 'earnings',
                new_balance: newReferrerBalance,
                description: `Referral commission from ${profile.username}'s task`,
                status: 'completed',
                metadata: {
                  referred_user_id: user.id,
                  task_id: userTask.task_id,
                },
              });

            console.log('Referral commission paid:', { referrerId: profile.referred_by, amount: commissionAmount });
          }
        }
      }
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
