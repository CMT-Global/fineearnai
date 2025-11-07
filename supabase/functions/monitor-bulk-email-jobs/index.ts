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
    
    // PHASE 5: Include retry_count and max_retries for retry limit tracking
    const { data: stuckJobs, error: fetchError } = await supabase
      .from("bulk_email_jobs")
      .select("id, batch_id, processing_worker_id, last_heartbeat, processed_count, total_recipients, processing_metadata, retry_count, max_retries")
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
    
    // PHASE 5: Reset each stuck job with retry limit tracking
    const resetResults = [];
    
    for (const job of stuckJobs) {
      // PHASE 5 FIX: Use retry_count column instead of metadata reset_count
      const retryCount = job.retry_count || 0;
      const maxRetries = job.max_retries || 3;
      const resetHistory = job.processing_metadata?.reset_history || [];
      
      console.log(`🔄 [Job Monitor] Processing stuck job ${job.id} (worker: ${job.processing_worker_id})`);
      console.log(`   Last heartbeat: ${job.last_heartbeat}`);
      console.log(`   Progress: ${job.processed_count}/${job.total_recipients}`);
      console.log(`   Retry count: ${retryCount}/${maxRetries}`);
      
      // PHASE 5 FIX: Check retry limit before resetting
      if (retryCount >= maxRetries) {
        console.error(`❌ [Job Monitor] Job ${job.id} exceeded retry limit (${retryCount}/${maxRetries}). Marking as PERMANENTLY FAILED.`);
        
        const { error: failError } = await supabase
          .from("bulk_email_jobs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            processing_worker_id: null,
            last_heartbeat: null,
            error_message: `Job exceeded maximum retry limit (${maxRetries} attempts) after repeated stalling. Last worker: ${job.processing_worker_id}. Progress: ${job.processed_count}/${job.total_recipients}`,
            processing_metadata: {
              ...job.processing_metadata,
              permanently_failed_reason: 'retry_limit_exceeded',
              final_retry_count: retryCount,
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
          console.log(`✅ [Job Monitor] Job ${job.id} marked as PERMANENTLY FAILED after ${retryCount} retries`);
          resetResults.push({
            job_id: job.id,
            batch_id: job.batch_id,
            action: "marked_failed",
            success: true,
            retry_count: retryCount,
            reason: `Exceeded maximum retry limit (${maxRetries})`,
          });
        }
        continue;
      }
      
      // PHASE 5 FIX: Increment retry_count and reset to 'queued' with exponential backoff
      const newRetryCount = retryCount + 1;
      const nextRetryAt = new Date(Date.now() + Math.pow(2, newRetryCount) * 60 * 1000).toISOString(); // 2^retry minutes
      const delayMinutes = Math.pow(2, newRetryCount);
      
      const resetEntry = {
        retry_number: newRetryCount,
        reset_at: new Date().toISOString(),
        next_retry_at: nextRetryAt,
        retry_delay_minutes: delayMinutes,
        stuck_worker_id: job.processing_worker_id,
        stuck_since: job.last_heartbeat,
        processed_count_at_reset: job.processed_count,
        total_recipients: job.total_recipients,
        minutes_stuck: Math.round((Date.now() - new Date(job.last_heartbeat).getTime()) / 1000 / 60),
      };
      
      // Add warning if approaching max retries
      if (newRetryCount >= 2) {
        console.warn(`⚠️  [Job Monitor] Job ${job.id} stuck for ${newRetryCount} time. Approaching max retries (${maxRetries}). Next retry in ${delayMinutes} minutes.`);
      } else {
        console.log(`🔄 [Job Monitor] Job ${job.id} will retry in ${delayMinutes} minutes (attempt ${newRetryCount}/${maxRetries})`);
      }
      
      const { error: resetError } = await supabase
        .from("bulk_email_jobs")
        .update({
          status: "queued",
          retry_count: newRetryCount,
          next_retry_at: nextRetryAt,
          processing_worker_id: null,
          last_heartbeat: null,
          error_message: `Job was stuck and automatically reset (retry ${newRetryCount}/${maxRetries} in ${delayMinutes}min). Last worker: ${job.processing_worker_id}. Stuck since: ${job.last_heartbeat}. Progress: ${job.processed_count}/${job.total_recipients}`,
          processing_metadata: {
            ...job.processing_metadata,
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
        console.log(`✅ [Job Monitor] Successfully reset job ${job.id} (retry ${newRetryCount}/${maxRetries} in ${delayMinutes} minutes)`);
        resetResults.push({
          job_id: job.id,
          batch_id: job.batch_id,
          action: "reset",
          success: true,
          retry_count: newRetryCount,
          next_retry_at: nextRetryAt,
          retry_delay_minutes: delayMinutes,
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
