import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Phase 2.3: Enhanced logging with execution time tracking
  const executionStartTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current date and times in different timezones
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const utcTime = now.toISOString();
    const eatTime = new Date(now.getTime() + (3 * 60 * 60 * 1000)).toISOString(); // UTC+3 for EAT
    
    console.log(`🔄 [${requestId}] Starting daily reset at ${utcTime} (UTC)`);
    console.log(`🕐 [${requestId}] EAT Time: ${eatTime}`);
    console.log(`📅 [${requestId}] Reset Date: ${currentDate}`);
    
    // Reset daily counters for all users where last_task_date is not today
    // This ensures we only reset users who haven't been reset today already
    const resetStartTime = Date.now();
    const { data, error } = await supabase
      .from('profiles')
      .update({
        tasks_completed_today: 0,
        skips_today: 0,
        last_task_date: currentDate,
      })
      .or(`last_task_date.is.null,last_task_date.lt.${currentDate}`)
      .select('id, username');

    const resetTime = Date.now() - resetStartTime;

    if (error) {
      console.error(`❌ [${requestId}] Error resetting daily counters (${resetTime}ms):`, error);
      throw error;
    }

    const resetCount = data?.length || 0;
    const executionTime = Date.now() - executionStartTime;
    
    console.log(`✅ [${requestId}] Successfully reset daily counters for ${resetCount} users (${executionTime}ms)`);
    console.log(`⏱️ [${requestId}] Reset operation took ${resetTime}ms`);
    console.log(`📊 [${requestId}] Total execution time: ${executionTime}ms`);
    
    // Phase 2.3: Log reset operation to audit table
    const logStartTime = Date.now();
    const { error: logError } = await supabase
      .from('daily_reset_logs')
      .insert({
        reset_date: currentDate,
        users_reset: resetCount,
        triggered_by: 'cron',
        execution_time_ms: executionTime,
        details: {
          utc_time: utcTime,
          eat_time: eatTime,
          reset_operation_ms: resetTime,
          request_id: requestId,
          user_sample: data?.slice(0, 5).map(u => ({ id: u.id, username: u.username })) || []
        }
      });

    const logTime = Date.now() - logStartTime;

    if (logError) {
      // Don't fail the entire operation if logging fails
      console.error(`⚠️ [${requestId}] Failed to log reset operation (${logTime}ms):`, logError);
    } else {
      console.log(`📝 [${requestId}] Reset operation logged to audit table (${logTime}ms)`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Daily counters reset successfully',
        usersReset: resetCount,
        timestamp: utcTime,
        eatTime: eatTime,
        currentDate,
        executionTimeMs: executionTime,
        requestId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    const executionTime = Date.now() - executionStartTime;
    console.error(`💥 [${requestId}] Function error (${executionTime}ms):`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        requestId,
        executionTimeMs: executionTime
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
