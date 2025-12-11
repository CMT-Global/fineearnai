import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
Deno.serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    const startTime = Date.now();
    console.log('🔍 Starting task pool monitoring...');
    // Get task pool health from database function
    const { data: healthData, error: healthError } = await supabase.rpc('get_task_pool_health').single();
    if (healthError) {
      console.error('❌ Error getting task pool health:', healthError);
      throw healthError;
    }
    const health = healthData;
    console.log('📊 Task Pool Health:', {
      active_tasks: health.active_tasks,
      total_tasks: health.total_tasks,
      completed_last_24h: health.completed_last_24h,
      avg_completion_rate: health.avg_completion_rate,
      status: health.health_status
    });
    // Record metrics
    const { error: metricsError } = await supabase.from('task_pool_metrics').insert({
      active_task_count: health.active_tasks,
      total_task_count: health.total_tasks,
      tasks_completed_last_24h: health.completed_last_24h,
      average_completion_rate: health.avg_completion_rate,
      alert_triggered: health.health_status === 'critical' || health.health_status === 'warning',
      alert_message: health.health_status === 'critical' || health.health_status === 'warning' ? health.recommendation : null
    });
    if (metricsError) {
      console.error('⚠️ Error recording metrics:', metricsError);
    }
    // Create admin notification if critical or warning
    if (health.health_status === 'critical' || health.health_status === 'warning') {
      console.log(`⚠️ ${health.health_status.toUpperCase()}: ${health.recommendation}`);
      // Get all admin users
      const { data: adminRoles, error: adminError } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
      if (adminError) {
        console.error('❌ Error fetching admin users:', adminError);
      } else if (adminRoles && adminRoles.length > 0) {
        // Create notifications for each admin
        const notifications = adminRoles.map((admin)=>({
            user_id: admin.user_id,
            type: health.health_status === 'critical' ? 'system_alert' : 'system_warning',
            title: `Task Pool ${health.health_status === 'critical' ? 'Critical' : 'Warning'}`,
            message: health.recommendation,
            priority: health.health_status === 'critical' ? 'high' : 'medium',
            is_read: false,
            metadata: {
              active_tasks: health.active_tasks,
              total_tasks: health.total_tasks,
              completed_last_24h: health.completed_last_24h,
              health_status: health.health_status
            }
          }));
        const { error: notifError } = await supabase.from('notifications').insert(notifications);
        if (notifError) {
          console.error('❌ Error creating admin notifications:', notifError);
        } else {
          console.log(`✅ Created ${notifications.length} admin notification(s)`);
        }
      }
    }
    const executionTime = Date.now() - startTime;
    console.log(`✅ Task pool monitoring completed in ${executionTime}ms`);
    return new Response(JSON.stringify({
      success: true,
      health: health,
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('💥 Fatal error in task pool monitoring:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Unknown error',
      details: 'Failed to monitor task pool'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
