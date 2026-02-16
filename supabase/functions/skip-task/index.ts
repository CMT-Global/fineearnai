import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  const requestId = crypto.randomUUID();
  const requestStartTime = Date.now();
  console.log(`🚀 [${requestId}] Skip task request started at ${new Date().toISOString()}`);
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error(`❌ [${requestId}] No authorization header provided`);
      return new Response(JSON.stringify({
        error: 'unauthorized',
        message: 'No authorization header provided'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 401
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error(`❌ [${requestId}] Authentication failed:`, authError?.message);
      return new Response(JSON.stringify({
        error: 'unauthorized',
        message: 'Authentication failed'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 401
      });
    }
    console.log(`✅ [${requestId}] User authenticated: ${user.id}`);
    // Fetch user profile with current skip count
    const { data: profile, error: profileError } = await supabase.from('profiles').select('*, membership_plan').eq('id', user.id).single();
    if (profileError || !profile) {
      console.error(`❌ [${requestId}] Profile fetch error:`, profileError);
      return new Response(JSON.stringify({
        error: 'profile_not_found',
        message: 'User profile not found'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 404
      });
    }
    if (profile.profile_completed !== true) {
      return new Response(JSON.stringify({
        error: 'profile_incomplete',
        message: 'Complete your profile setup to access tasks.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403
      });
    }
    // Resolve plan: by name first, then fallback to default free-tier (e.g. profile has stale "free" but DB uses "Trainee")
    let planName = (profile.membership_plan && String(profile.membership_plan).trim()) || '';
    if (!planName) {
      const { data: defaultPlan } = await supabase.from('membership_plans').select('name').eq('account_type', 'free').eq('is_active', true).limit(1).maybeSingle();
      planName = defaultPlan?.name ?? '';
    }
    let { data: membershipPlan, error: planError } = await supabase.from('membership_plans').select('task_skip_limit_per_day').eq('name', planName).eq('is_active', true).maybeSingle();
    if (!planError && !membershipPlan) {
      const fallback = await supabase.from('membership_plans').select('task_skip_limit_per_day').eq('account_type', 'free').eq('is_active', true).limit(1).maybeSingle();
      membershipPlan = fallback.data ?? null;
      planError = fallback.error ?? null;
      if (membershipPlan) {
        console.warn(`⚠️ [${requestId}] Plan "${profile.membership_plan ?? ''}" not found; using default free-tier plan for user ${user.id}`);
      }
    }
    if (planError || !membershipPlan) {
      console.error(`❌ [${requestId}] Membership plan fetch error:`, planError ?? 'no matching plan and no default free-tier plan');
      return new Response(JSON.stringify({
        error: 'plan_not_found',
        message: 'Membership plan not found or inactive'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 404
      });
    }
    console.log(`📊 [${requestId}] Current skips: ${profile.skips_today}/${membershipPlan.task_skip_limit_per_day}`);
    // Check if skip limit reached
    if (profile.skips_today >= membershipPlan.task_skip_limit_per_day) {
      console.log(`⚠️ [${requestId}] Skip limit reached`);
      return new Response(JSON.stringify({
        error: 'skip_limit_reached',
        message: 'Daily skip limit reached. You cannot skip any more tasks today.',
        skipsToday: profile.skips_today,
        skipLimit: membershipPlan.task_skip_limit_per_day
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 429
      });
    }
    // Increment skip counter with optimistic locking
    const newSkipCount = profile.skips_today + 1;
    const { error: updateError } = await supabase.from('profiles').update({
      skips_today: newSkipCount,
      last_activity: new Date().toISOString()
    }).eq('id', user.id).eq('skips_today', profile.skips_today); // Optimistic lock
    if (updateError) {
      console.error(`❌ [${requestId}] Skip increment failed:`, updateError);
      // If optimistic lock failed, likely concurrent request
      if (updateError.code === 'PGRST116') {
        return new Response(JSON.stringify({
          error: 'concurrent_skip',
          message: 'Please wait a moment before skipping again'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 409
        });
      }
      return new Response(JSON.stringify({
        error: 'update_failed',
        message: 'Failed to increment skip counter'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }
    const executionTime = Date.now() - requestStartTime;
    console.log(`✅ [${requestId}] Skip successful (${executionTime}ms). New count: ${newSkipCount}/${membershipPlan.task_skip_limit_per_day}`);
    // Record metrics (non-blocking)
    supabase.from('edge_function_metrics').insert({
      function_name: 'skip-task',
      execution_time_ms: executionTime,
      success: true,
      user_id: user.id,
      metadata: {
        skips_today: newSkipCount,
        skip_limit: membershipPlan.task_skip_limit_per_day
      }
    }).then(({ error })=>{
      if (error) {
        console.error(`⚠️ [${requestId}] Failed to record metrics:`, error);
      }
    });
    return new Response(JSON.stringify({
      success: true,
      skipsToday: newSkipCount,
      skipLimit: membershipPlan.task_skip_limit_per_day,
      remainingSkips: membershipPlan.task_skip_limit_per_day - newSkipCount,
      message: 'Task skipped successfully'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    const executionTime = Date.now() - requestStartTime;
    console.error(`💥 [${requestId}] Fatal error in skip-task (${executionTime}ms):`, {
      errorMessage: error.message,
      errorCode: error.code,
      errorName: error.name,
      stack: error.stack
    });
    return new Response(JSON.stringify({
      error: 'internal_error',
      message: error.message || 'An unexpected error occurred while skipping task',
      code: error.code || 'UNKNOWN'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
