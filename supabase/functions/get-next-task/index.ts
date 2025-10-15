import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory cache for user stats (1 minute TTL)
const statsCache = new Map<string, { data: any; expiresAt: number }>();

// In-memory cache for membership plan data (5 minute TTL)
const planCache = new Map<string, { data: any; expiresAt: number }>();

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
    // STEP 2: GET USER STATS (with fallback and caching)
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
      // Try materialized view first, fall back to direct query if not available
      let statsData: any = null;
      let statsError: any = null;

      // Try materialized view
      const mvResult = await supabase
        .from('user_daily_stats')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (mvResult.error && mvResult.error.code === 'PGRST205') {
        // Materialized view doesn't exist yet, use fallback query
        console.log('Materialized view not found, using fallback query');
        
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*, membership_plans!inner(*)')
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

        // Map profile data to stats format
        const plan = (profile as any).membership_plans;
        statsData = {
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
      } else {
        statsData = mvResult.data;
        statsError = mvResult.error;
      }

      if (statsError) {
        console.error('Error fetching user stats:', statsError);
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

      if (!statsData) {
        console.error('User stats not found:', user.id);
        return new Response(
          JSON.stringify({ 
            error: 'user_not_found',
            message: 'User profile not found. Please contact support.' 
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          }
        );
      }

      userStats = statsData;
      
      // Cache for 1 minute
      statsCache.set(cacheKey, {
        data: userStats,
        expiresAt: now + 60000 // 1 minute
      });

      console.log('Cache miss for user stats, fetched and cached:', user.id);
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
      return new Response(
        JSON.stringify({ 
          error: 'daily_limit_reached',
          message: 'You have reached your daily task limit. Upgrade your plan to complete more tasks.',
          tasksCompletedToday: userStats.tasks_completed_today,
          dailyLimit: userStats.daily_task_limit,
          membershipPlan: userStats.membership_plan
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429,
        }
      );
    }

    // ============================================================================
    // STEP 5: GET NEXT AVAILABLE TASK USING DATABASE FUNCTION
    // ============================================================================
    
    const { data: taskData, error: taskError } = await supabase
      .rpc('get_next_available_task', { p_user_id: user.id });

    if (taskError) {
      console.error('Error calling get_next_available_task:', taskError);
      return new Response(
        JSON.stringify({ 
          error: 'task_fetch_error',
          message: 'Failed to fetch next task' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // Check if any tasks are available
    if (!taskData || taskData.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'no_tasks_available',
          message: 'No more tasks available at the moment. Please check back later.',
          hasMoreTasks: false
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }

    const task = taskData[0];

    // ============================================================================
    // STEP 6: GET AVAILABLE TASK COUNT FOR PROGRESS TRACKING
    // ============================================================================
    
    const { data: taskCount, error: countError } = await supabase
      .rpc('get_available_task_count', { p_user_id: user.id });

    const availableTaskCount = countError ? 0 : (taskCount || 0);

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

    console.log('Successfully retrieved next task for user:', user.id, 'Task ID:', task.task_id);

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Unexpected error in get-next-task:', error);
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
