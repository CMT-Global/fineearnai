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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current date in YYYY-MM-DD format
    const currentDate = new Date().toISOString().split('T')[0];
    
    console.log(`Starting daily reset at ${new Date().toISOString()}`);
    
    // Reset daily counters for all users where last_task_date is not today
    // This ensures we only reset users who haven't been reset today already
    const { data, error } = await supabase
      .from('profiles')
      .update({
        tasks_completed_today: 0,
        skips_today: 0,
        last_task_date: currentDate,
      })
      .or(`last_task_date.is.null,last_task_date.lt.${currentDate}`)
      .select('id, username, tasks_completed_today, skips_today');

    if (error) {
      console.error('❌ Error resetting daily counters:', error);
      throw error;
    }

    const resetCount = data?.length || 0;
    console.log(`✅ Successfully reset daily counters for ${resetCount} users at ${new Date().toISOString()}`);
    
    // Also clear the dailyLimitReached flag in Zustand by invalidating user cache
    // Note: This happens automatically when users refresh or when get-next-task is called

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Daily counters reset successfully',
        usersReset: resetCount,
        timestamp: new Date().toISOString(),
        currentDate
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
