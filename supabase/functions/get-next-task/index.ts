import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory cache for user stats (5 second TTL - Phase 1 optimization)
const statsCache = new Map<string, { data: any; expiresAt: number }>();

// In-memory cache for membership plan data (5 minute TTL)
const planCache = new Map<string, { data: any; expiresAt: number }>();

// Cache invalidation helper
export function invalidateUserStatsCache(userId: string) {
  const cacheKey = `stats_${userId}`;
  statsCache.delete(cacheKey);
  console.log('🗑️ Cache invalidated for user:', userId);
}

/**
 * Get Next Task Edge Function
 * 
 * Purpose: Efficiently retrieve the next available task for a user with all necessary stats
 * Performance: Single edge function call replaces 5-7 sequential queries
 * Expected execution time: < 200ms (warm), < 500ms (cold start)
 */
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ============================================================================
    // STEP 1: AUTHENTICATE USER
    // ============================================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          error: 'unauthorized',
          message: 'No authorization header provided' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ 
          error: 'unauthorized',
          message: 'Invalid or expired token' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // ============================================================================
    // STEP 2: GET USER STATS (Direct DB query - no materialized view)
    // ============================================================================
    const cacheKey = `stats_${user.id}`;
    const now = Date.now();
    let userStats: any;

    // Check cache first
    const cached = statsCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      console.log('Cache hit for user stats:', user.id);
      userStats = cached.data;
    } else {
      // Always fetch fresh data from profiles + membership_plans
      console.log('Cache miss - fetching fresh user stats from database');
      
      // Fetch the profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        console.error('Error fetching profile:', profileError);
        return new Response(
          JSON.stringify({ 
            error: 'stats_error',
            message: 'Failed to fetch user statistics' 
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        );
      }

      // Fetch the membership plan separately
      const { data: plan, error: planError } = await supabase
        .from('membership_plans')
        .select('*')
        .eq('name', profile.membership_plan)
        .single();

      if (planError || !plan) {
        console.error('Error fetching membership plan:', planError);
        return new Response(
          JSON.stringify({ 
            error: 'stats_error',
            message: 'Failed to fetch membership plan' 
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        );
      }

      // Map profile and plan data to stats format
      userStats = {
        user_id: profile.id,
        username: profile.username,
        tasks_completed_today: profile.tasks_completed_today,
        skips_today: profile.skips_today,
        membership_plan: profile.membership_plan,
        earnings_wallet_balance: profile.earnings_wallet_balance,
        deposit_wallet_balance: profile.deposit_wallet_balance,
        total_earned: profile.total_earned,
        last_task_date: profile.last_task_date,
        plan_expires_at: profile.plan_expires_at,
        account_status: profile.account_status,
        daily_task_limit: plan.daily_task_limit,
        earning_per_task: plan.earning_per_task,
        task_skip_limit_per_day: plan.task_skip_limit_per_day,
        task_commission_rate: plan.task_commission_rate,
        deposit_commission_rate: plan.deposit_commission_rate,
        min_withdrawal: plan.min_withdrawal,
        min_daily_withdrawal: plan.min_daily_withdrawal,
        max_daily_withdrawal: plan.max_daily_withdrawal,
        remaining_tasks: plan.daily_task_limit - profile.tasks_completed_today,
        remaining_skips: plan.task_skip_limit_per_day - profile.skips_today,
      };
      
      // Cache for 5 seconds (Phase 1 optimization)
      statsCache.set(cacheKey, {
        data: userStats,
        expiresAt: now + 5000 // 5 seconds
      });

      console.log('✅ Fresh user stats fetched and cached:', {
        userId: user.id,
        tasksCompletedToday: userStats.tasks_completed_today,
        earningsBalance: userStats.earnings_wallet_balance,
        remainingTasks: userStats.remaining_tasks
      });
    }

    // ============================================================================
    // STEP 2.5: SAFETY NET - AUTO-RESET IF DATE HAS CHANGED (Phase 3)
    // ============================================================================
    // This is a defensive mechanism in case CRON job fails
    // If last_task_date is older than today, reset counters automatically
    
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    if (userStats.last_task_date && userStats.last_task_date < currentDate) {
      console.log('📅 Date changed detected - auto-resetting daily counters', {
        userId: user.id,
        lastTaskDate: userStats.last_task_date,
        currentDate: currentDate,
        tasksCompletedToday: userStats.tasks_completed_today
      });
      
      // Reset counters in database
      const { error: resetError } = await supabase
        .from('profiles')
        .update({
          tasks_completed_today: 0,
          skips_today: 0,
          last_task_date: currentDate
        })
        .eq('id', user.id);
      
      if (resetError) {
        console.error('❌ Error auto-resetting daily counters:', resetError);
        // Don't fail the request - log error and continue
      } else {
        console.log('✅ Daily counters auto-reset successfully for user:', user.id);
        
        // Update cached stats to reflect reset
        userStats.tasks_completed_today = 0;
        userStats.skips_today = 0;
        userStats.last_task_date = currentDate;
        userStats.remaining_tasks = userStats.daily_task_limit; // Full limit available
        userStats.remaining_skips = userStats.task_skip_limit_per_day; // Full skips available
        
        // Invalidate cache to force fresh fetch on next request
        statsCache.delete(cacheKey);
        
        console.log('🔄 Cache invalidated after auto-reset');
      }
    }

    // ============================================================================
    // STEP 3: VALIDATE ACCOUNT STATUS AND PLAN EXPIRY
    // ============================================================================
    
    // Check if account is active
    if (userStats.account_status !== 'active') {
      return new Response(
        JSON.stringify({ 
          error: 'account_inactive',
          message: `Your account is ${userStats.account_status}. Please contact support.`,
          accountStatus: userStats.account_status
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    // Check if membership plan has expired
    if (userStats.plan_expires_at) {
      const expiryDate = new Date(userStats.plan_expires_at);
      if (expiryDate < new Date()) {
        return new Response(
          JSON.stringify({ 
            error: 'plan_expired',
            message: 'Your membership plan has expired. Please upgrade to continue.',
            planExpiresAt: userStats.plan_expires_at
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          }
        );
      }
    }

    // ============================================================================
    // STEP 4: CHECK DAILY TASK LIMIT
    // ============================================================================
    
    if (userStats.tasks_completed_today >= userStats.daily_task_limit) {
      console.log('Daily limit reached for user:', user.id, {
        tasksCompletedToday: userStats.tasks_completed_today,
        dailyLimit: userStats.daily_task_limit
      });
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'daily_limit_reached',
          message: 'You have reached your daily task limit. Upgrade your plan to complete more tasks.',
          task: null,
          userStats: {
            username: userStats.username,
            tasksCompletedToday: userStats.tasks_completed_today,
            dailyLimit: userStats.daily_task_limit,
            remainingTasks: 0,
            earningsBalance: Number(userStats.earnings_wallet_balance),
            depositBalance: Number(userStats.deposit_wallet_balance),
            totalEarned: Number(userStats.total_earned),
            skipsToday: userStats.skips_today,
            skipLimit: userStats.task_skip_limit_per_day,
            remainingSkips: userStats.remaining_skips,
            membershipPlan: userStats.membership_plan,
            planExpiresAt: userStats.plan_expires_at
          },
          hasMoreTasks: false,
          availableTaskCount: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // ============================================================================
    // STEP 5: GET NEXT TASK WITH COUNT (OPTIMIZED - SINGLE QUERY)
    // ============================================================================
    
    console.log('⚡ Fetching next task (optimized) for user:', user.id);

    const { data: taskData, error: taskError } = await supabase
      .rpc('get_next_task_optimized', { p_user_id: user.id });

    if (taskError) {
      console.error('❌ Error calling get_next_task_optimized RPC:', {
        code: taskError.code,
        message: taskError.message,
        details: taskError.details,
        userId: user.id
      });
      return new Response(
        JSON.stringify({ 
          error: 'task_fetch_error',
          message: 'Failed to fetch next task',
          details: taskError.message 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // Check if any tasks are available
    if (!taskData || taskData.length === 0) {
      console.log('No tasks available for user:', user.id);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'no_tasks_available',
          message: 'No more tasks available at the moment. Please check back later.',
          task: null,
          userStats: {
            username: userStats.username,
            tasksCompletedToday: userStats.tasks_completed_today,
            dailyLimit: userStats.daily_task_limit,
            remainingTasks: userStats.remaining_tasks,
            earningsBalance: Number(userStats.earnings_wallet_balance),
            depositBalance: Number(userStats.deposit_wallet_balance),
            totalEarned: Number(userStats.total_earned),
            skipsToday: userStats.skips_today,
            skipLimit: userStats.task_skip_limit_per_day,
            remainingSkips: userStats.remaining_skips,
            membershipPlan: userStats.membership_plan,
            planExpiresAt: userStats.plan_expires_at
          },
          hasMoreTasks: false,
          availableTaskCount: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const task = taskData[0];
    const availableTaskCount = task.available_count || 0;
    
    console.log('✅ Retrieved task for user:', user.id, {
      taskId: task.task_id,
      category: task.category,
      difficulty: task.difficulty,
      availableCount: availableTaskCount
    });

    // ============================================================================
    // STEP 7: CONSTRUCT COMPREHENSIVE RESPONSE
    // ============================================================================
    
    const response = {
      success: true,
      task: {
        id: task.task_id,
        prompt: task.prompt,
        response_a: task.response_a,
        response_b: task.response_b,
        category: task.category,
        difficulty: task.difficulty,
        reward: userStats.earning_per_task,
        created_at: task.created_at
      },
      userStats: {
        username: userStats.username,
        tasksCompletedToday: userStats.tasks_completed_today,
        dailyLimit: userStats.daily_task_limit,
        remainingTasks: userStats.remaining_tasks,
        earningsBalance: Number(userStats.earnings_wallet_balance),
        depositBalance: Number(userStats.deposit_wallet_balance),
        totalEarned: Number(userStats.total_earned),
        skipsToday: userStats.skips_today,
        skipLimit: userStats.task_skip_limit_per_day,
        remainingSkips: userStats.remaining_skips,
        membershipPlan: userStats.membership_plan,
        planExpiresAt: userStats.plan_expires_at
      },
      hasMoreTasks: availableTaskCount > 1, // More than current task
      availableTaskCount: availableTaskCount - 1, // Excluding current task
      timestamp: new Date().toISOString()
    };

    console.log('✅ Successfully retrieved next task for user:', user.id, {
      taskId: task.task_id,
      category: task.category,
      difficulty: task.difficulty,
      reward: userStats.earning_per_task,
      tasksCompletedToday: userStats.tasks_completed_today,
      dailyLimit: userStats.daily_task_limit,
      remainingTasks: userStats.remaining_tasks,
      availableTaskCount: availableTaskCount
    });

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Unexpected error in get-next-task edge function:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      details: error.toString()
    });
    return new Response(
      JSON.stringify({ 
        error: 'internal_error',
        message: error.message || 'An unexpected error occurred',
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
