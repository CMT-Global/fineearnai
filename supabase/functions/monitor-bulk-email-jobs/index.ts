import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log(`🔍 [Job Monitor] Starting stuck job detection...`);
    
    // Find jobs that are stuck in processing (last_heartbeat > 10 minutes ago)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: stuckJobs, error: fetchError } = await supabase
      .from("bulk_email_jobs")
      .select("id, batch_id, processing_worker_id, last_heartbeat, processed_count, total_recipients")
      .eq("status", "processing")
      .not("last_heartbeat", "is", null)
      .lt("last_heartbeat", tenMinutesAgo);
    
    if (fetchError) {
      console.error(`❌ [Job Monitor] Error fetching stuck jobs:`, fetchError);
      throw fetchError;
    }
    
    if (!stuckJobs || stuckJobs.length === 0) {
      console.log(`✅ [Job Monitor] No stuck jobs found. All jobs are healthy.`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No stuck jobs found",
          checked_at: new Date().toISOString()
        }),
        { 
          status: 200, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        }
      );
    }
    
    console.log(`⚠️  [Job Monitor] Found ${stuckJobs.length} stuck job(s)`);
    
    // Reset each stuck job
    const resetResults = [];
    
    for (const job of stuckJobs) {
      console.log(`🔄 [Job Monitor] Resetting stuck job ${job.id} (worker: ${job.processing_worker_id})`);
      console.log(`   Last heartbeat: ${job.last_heartbeat}`);
      console.log(`   Progress: ${job.processed_count}/${job.total_recipients}`);
      
      const { error: resetError } = await supabase
        .from("bulk_email_jobs")
        .update({
          status: "queued",
          processing_worker_id: null,
          last_heartbeat: null,
          error_message: `Job was stuck and automatically reset. Last worker: ${job.processing_worker_id}. Progress before reset: ${job.processed_count}/${job.total_recipients}`,
        })
        .eq("id", job.id);
      
      if (resetError) {
        console.error(`❌ [Job Monitor] Failed to reset job ${job.id}:`, resetError);
        resetResults.push({
          job_id: job.id,
          batch_id: job.batch_id,
          success: false,
          error: resetError.message,
        });
      } else {
        console.log(`✅ [Job Monitor] Successfully reset job ${job.id}`);
        resetResults.push({
          job_id: job.id,
          batch_id: job.batch_id,
          success: true,
          processed_count: job.processed_count,
          total_recipients: job.total_recipients,
        });
      }
    }
    
    const successCount = resetResults.filter(r => r.success).length;
    const failureCount = resetResults.filter(r => !r.success).length;
    
    console.log(`📊 [Job Monitor] Reset complete: ${successCount} succeeded, ${failureCount} failed`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Reset ${successCount} stuck job(s)`,
        stuck_jobs_found: stuckJobs.length,
        reset_successful: successCount,
        reset_failed: failureCount,
        results: resetResults,
        checked_at: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
    
  } catch (error) {
    console.error(`❌ [Job Monitor] Fatal error:`, error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
});
