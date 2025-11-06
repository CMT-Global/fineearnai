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
    
    // PHASE 4: Include processing_metadata to track reset count
    const { data: stuckJobs, error: fetchError } = await supabase
      .from("bulk_email_jobs")
      .select("id, batch_id, processing_worker_id, last_heartbeat, processed_count, total_recipients, processing_metadata")
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
    
    // PHASE 4: Reset each stuck job with enhanced tracking
    const resetResults = [];
    const MAX_RESETS = 3;
    
    for (const job of stuckJobs) {
      const currentResetCount = (job.processing_metadata?.reset_count || 0);
      const resetHistory = job.processing_metadata?.reset_history || [];
      
      console.log(`🔄 [Job Monitor] Processing stuck job ${job.id} (worker: ${job.processing_worker_id})`);
      console.log(`   Last heartbeat: ${job.last_heartbeat}`);
      console.log(`   Progress: ${job.processed_count}/${job.total_recipients}`);
      console.log(`   Reset count: ${currentResetCount}/${MAX_RESETS}`);
      
      // PHASE 4: Check if job has been reset too many times
      if (currentResetCount >= MAX_RESETS) {
        console.error(`❌ [Job Monitor] Job ${job.id} has been reset ${currentResetCount} times. Marking as FAILED.`);
        
        const { error: failError } = await supabase
          .from("bulk_email_jobs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: `Job failed after ${MAX_RESETS} automatic resets. Manual intervention required. Last worker: ${job.processing_worker_id}. Progress: ${job.processed_count}/${job.total_recipients}`,
            processing_metadata: {
              ...job.processing_metadata,
              reset_count: currentResetCount,
              permanently_failed_at: new Date().toISOString(),
              final_worker_id: job.processing_worker_id,
              final_progress: `${job.processed_count}/${job.total_recipients}`,
            },
          })
          .eq("id", job.id);
        
        if (failError) {
          console.error(`❌ [Job Monitor] Failed to mark job ${job.id} as failed:`, failError);
          resetResults.push({
            job_id: job.id,
            batch_id: job.batch_id,
            action: "mark_failed",
            success: false,
            error: failError.message,
          });
        } else {
          console.log(`✅ [Job Monitor] Job ${job.id} marked as FAILED after ${MAX_RESETS} resets`);
          resetResults.push({
            job_id: job.id,
            batch_id: job.batch_id,
            action: "marked_failed",
            success: true,
            reset_count: currentResetCount,
            reason: `Exceeded maximum reset attempts (${MAX_RESETS})`,
          });
        }
        continue;
      }
      
      // PHASE 4: Normal reset with enhanced metadata tracking
      const newResetCount = currentResetCount + 1;
      const resetEntry = {
        reset_number: newResetCount,
        reset_at: new Date().toISOString(),
        stuck_worker_id: job.processing_worker_id,
        stuck_since: job.last_heartbeat,
        processed_count_at_reset: job.processed_count,
        total_recipients: job.total_recipients,
        minutes_stuck: Math.round((Date.now() - new Date(job.last_heartbeat).getTime()) / 1000 / 60),
      };
      
      // Add warning if approaching max resets
      if (newResetCount >= 2) {
        console.warn(`⚠️  [Job Monitor] Job ${job.id} stuck for ${newResetCount} time. Approaching max resets (${MAX_RESETS}).`);
      }
      
      const { error: resetError } = await supabase
        .from("bulk_email_jobs")
        .update({
          status: "queued",
          processing_worker_id: null,
          last_heartbeat: null,
          error_message: `Job was stuck and automatically reset (attempt ${newResetCount}/${MAX_RESETS}). Last worker: ${job.processing_worker_id}. Stuck since: ${job.last_heartbeat}. Progress: ${job.processed_count}/${job.total_recipients}`,
          processing_metadata: {
            ...job.processing_metadata,
            reset_count: newResetCount,
            last_reset_at: new Date().toISOString(),
            reset_history: [...resetHistory, resetEntry],
          },
        })
        .eq("id", job.id);
      
      if (resetError) {
        console.error(`❌ [Job Monitor] Failed to reset job ${job.id}:`, resetError);
        resetResults.push({
          job_id: job.id,
          batch_id: job.batch_id,
          action: "reset",
          success: false,
          error: resetError.message,
        });
      } else {
        console.log(`✅ [Job Monitor] Successfully reset job ${job.id} (reset ${newResetCount}/${MAX_RESETS})`);
        resetResults.push({
          job_id: job.id,
          batch_id: job.batch_id,
          action: "reset",
          success: true,
          reset_count: newResetCount,
          processed_count: job.processed_count,
          total_recipients: job.total_recipients,
          minutes_stuck: resetEntry.minutes_stuck,
        });
      }
    }
    
    const successCount = resetResults.filter(r => r.success).length;
    const failureCount = resetResults.filter(r => !r.success).length;
    const failedCount = resetResults.filter(r => r.action === "marked_failed").length;
    const resetCount = resetResults.filter(r => r.action === "reset").length;
    
    console.log(`📊 [Job Monitor] Processing complete:`);
    console.log(`   - Reset: ${resetCount} job(s)`);
    console.log(`   - Marked as failed: ${failedCount} job(s)`);
    console.log(`   - Failures: ${failureCount}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${stuckJobs.length} stuck job(s): ${resetCount} reset, ${failedCount} marked as failed`,
        stuck_jobs_found: stuckJobs.length,
        jobs_reset: resetCount,
        jobs_marked_failed: failedCount,
        operations_successful: successCount,
        operations_failed: failureCount,
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
