import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { wrapInProfessionalTemplate } from "../_shared/email-template-wrapper.ts";
import { getSystemSecrets } from "../_shared/secrets.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BATCH_SIZE = 500; // Process 500 recipients per cycle
const RESEND_BATCH_LIMIT = 100; // Resend allows 100 emails per batch API call
const RATE_LIMIT_DELAY_MS = 500; // 500ms delay between batch API calls
const MAX_EXECUTION_TIME_MS = 4 * 60 * 1000; // 4 minutes (safe buffer before 5min timeout)
const CONTINUATION_DELAY_MS = 2000; // 2 second delay before triggering continuation
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
// Helper: Sleep function for rate limiting
const sleep = (ms)=>new Promise((resolve)=>setTimeout(resolve, ms));
// PHASE 5: Helper - Calculate exponential backoff delay for retries
const calculateRetryDelay = (retryCount)=>{
  // Formula: 2^retry_count minutes, capped at 15 minutes
  // Retry 1: 2^1 = 2 minutes
  // Retry 2: 2^2 = 4 minutes
  // Retry 3: 2^3 = 8 minutes
  // Retry 4+: 15 minutes (cap)
  const exponentialMinutes = Math.pow(2, retryCount);
  const cappedMinutes = Math.min(exponentialMinutes, 15);
  return cappedMinutes * 60 * 1000; // Convert to milliseconds
};
// PHASE 5: Helper - Calculate next retry timestamp
const calculateNextRetryAt = (retryCount)=>{
  const delayMs = calculateRetryDelay(retryCount);
  const nextRetryDate = new Date(Date.now() + delayMs);
  return nextRetryDate.toISOString();
};
// Helper: Personalize email content
const personalizeContent = (content, recipient)=>{
  return content.replace(/\{\{username\}\}/g, recipient.username || 'User').replace(/\{\{email\}\}/g, recipient.email || '').replace(/\{\{full_name\}\}/g, recipient.full_name || recipient.username || 'User');
};
// Helper: Split array into chunks
const chunkArray = (array, size)=>{
  const chunks = [];
  for(let i = 0; i < array.length; i += size){
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};
// PHASE 2: Helper - Retry with exponential backoff for 429 errors
const retryWithBackoff = async (operation, maxRetries = 3, initialDelay = 1000)=>{
  let lastError;
  for(let attempt = 0; attempt < maxRetries; attempt++){
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      // Check if it's a 429 rate limit error
      const is429 = error?.status === 429 || error?.statusCode === 429 || error?.message?.includes('429') || error?.message?.toLowerCase().includes('rate limit');
      if (!is429 || attempt === maxRetries - 1) {
        // Not a rate limit error or last attempt, throw immediately
        throw error;
      }
      // Extract retry-after header if available (in seconds)
      const retryAfter = error?.headers?.['retry-after'] || error?.response?.headers?.['retry-after'];
      // Calculate delay: use retry-after if provided, otherwise exponential backoff
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : initialDelay * Math.pow(2, attempt);
      console.log(`⚠️  [429 Rate Limit] Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delay}ms...`);
      if (retryAfter) {
        console.log(`🔄 [429 Rate Limit] Using retry-after header: ${retryAfter}s`);
      }
      await sleep(delay);
    }
  }
  throw lastError;
};
const handler = async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const secrets = await getSystemSecrets(supabase);
    const resend = new Resend(secrets.resendApiKey);
    const startTime = Date.now();
    // Generate unique worker ID for this execution
    const workerId = `worker_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    console.log(`🔧 [Queue Processor] Worker ID: ${workerId}`);
    console.log(`🔄 [Queue Processor] Starting bulk email queue processor...`);
    // STEP 1: Fetch next job with locking (prevents race conditions)
    const { data: jobs, error: jobError } = await supabase.rpc("get_next_bulk_email_job");
    if (jobError) {
      console.error(`❌ [Queue Processor] Error fetching jobs:`, jobError);
      throw jobError;
    }
    if (!jobs || jobs.length === 0) {
      console.log(`✅ [Queue Processor] No jobs in queue. Exiting.`);
      return new Response(JSON.stringify({
        success: true,
        message: "No jobs in queue"
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    const job = jobs[0];
    console.log(`📧 [Queue Processor] Processing job: ${job.id} (Batch: ${job.batch_id})`);
    console.log(`📊 [Queue Processor] Progress: ${job.processed_count}/${job.total_recipients}`);
    if (job.next_retry_at) {
      const retryDate = new Date(job.next_retry_at);
      const now = new Date();
      const minutesUntilRetry = Math.round((retryDate.getTime() - now.getTime()) / 1000 / 60);
      console.log(`⏰ [Queue Processor] Job has retry schedule: ${job.next_retry_at} (in ${minutesUntilRetry} minutes)`);
    }
    // PHASE 5 FIX: Check retry limit before processing
    const retryCount = job.retry_count || 0;
    const maxRetries = job.max_retries || 3;
    console.log(`🔄 [Queue Processor] Retry status: ${retryCount}/${maxRetries}`);
    if (retryCount >= maxRetries) {
      console.error(`❌ [Queue Processor] Job ${job.id} exceeded retry limit (${retryCount}/${maxRetries})`);
      // Mark as permanently failed
      await supabase.from('bulk_email_jobs').update({
        status: 'failed',
        error_message: `Job exceeded maximum retry limit (${maxRetries} attempts)`,
        completed_at: new Date().toISOString(),
        processing_worker_id: null,
        last_heartbeat: null,
        processing_metadata: {
          ...job.processing_metadata,
          retry_limit_exceeded: true,
          final_retry_count: retryCount
        }
      }).eq('id', job.id);
      return new Response(JSON.stringify({
        success: false,
        message: `Job ${job.id} permanently failed after ${retryCount} retries`,
        job_id: job.id,
        retry_count: retryCount,
        max_retries: maxRetries
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    // STEP 2: Mark job as processing with worker ID and heartbeat
    if (job.status === "queued") {
      const { error: updateError } = await supabase.from("bulk_email_jobs").update({
        status: "processing",
        started_at: new Date().toISOString(),
        processing_worker_id: workerId,
        last_heartbeat: new Date().toISOString()
      }).eq("id", job.id);
      if (updateError) {
        console.error(`❌ [Queue Processor] Failed to mark job as processing:`, updateError);
        throw updateError;
      }
      console.log(`▶️  [Queue Processor] Job marked as processing by ${workerId}`);
    } else {
      // Update heartbeat for already processing job
      await supabase.from("bulk_email_jobs").update({
        last_heartbeat: new Date().toISOString(),
        processing_worker_id: workerId
      }).eq("id", job.id);
      console.log(`💓 [Queue Processor] Heartbeat updated for job ${job.id}`);
    }
    // STEP 3: Fetch dynamic email settings
    console.log(`⚙️  [Queue Processor] Fetching email settings...`);
    const { data: configData } = await supabase.from("platform_config").select("value").eq("key", "email_settings").maybeSingle();
    const emailSettings = configData?.value || {
      from_address: "noreply@profitchips.com",
      from_name: "ProfitChips",
      reply_to_address: "support@profitchips.com",
      platform_name: "ProfitChips",
      platform_url: "https://profitchips.com",
    };
    console.log(`✅ [Queue Processor] Using settings - From: ${emailSettings.from_name} <${emailSettings.from_address}>`);
    // STEP 4: Fetch next batch via DB RPC (scalable — no URL bloat, works for 100K+ users)
    // reserve_bulk_email_batch() atomically writes 'pending' rows BEFORE we send,
    // so if this function crashes mid-send, the retry won't re-send the same emails.
    console.log(`📥 [Queue Processor] Reserving next ${BATCH_SIZE} unprocessed recipients via DB RPC...`);
    const { data: recipients, error: recipientsError } = await supabase.rpc(
      'reserve_bulk_email_batch',
      { p_job_id: job.id, p_batch_size: BATCH_SIZE }
    );
    if (recipientsError) {
      console.error(`❌ [Queue Processor] Error fetching recipients:`, recipientsError);
      await supabase.from("bulk_email_jobs").update({
        status: "failed",
        error_message: `Failed to fetch recipients: ${recipientsError.message}`
      }).eq("id", job.id);
      throw recipientsError;
    }
    if (!recipients || recipients.length === 0) {
      console.log(`✅ [Queue Processor] No more recipients. Marking job as completed.`);
      await supabase.from("bulk_email_jobs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        last_processed_at: new Date().toISOString()
      }).eq("id", job.id);
      return new Response(JSON.stringify({
        success: true,
        message: "Job completed",
        job_id: job.id
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    console.log(`📨 [Queue Processor] Processing ${recipients.length} recipients`);
    // Check for cancellation request before processing
    if (job.cancel_requested) {
      console.log(`🛑 [Queue Processor] Job cancelled by admin. Stopping.`);
      await supabase.from("bulk_email_jobs").update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
        error_message: "Cancelled by administrator"
      }).eq("id", job.id);
      return new Response(JSON.stringify({
        success: true,
        message: "Job cancelled",
        job_id: job.id
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    // STEP 6: Split recipients into chunks of 100 for Resend Batch API
    const recipientChunks = chunkArray(recipients, RESEND_BATCH_LIMIT);
    console.log(`📦 [Queue Processor] Split into ${recipientChunks.length} chunks of max ${RESEND_BATCH_LIMIT}`);
    let successCount = 0;
    let failCount = 0;
    const emailLogs = [];
    const newIdempotencyKeys = []; // PHASE 1: Track new idempotency keys
    const rateLimitMetrics = []; // PHASE 3: Track rate limit metrics per batch
    // STEP 7: Process each chunk with Resend Batch API
    for(let chunkIndex = 0; chunkIndex < recipientChunks.length; chunkIndex++){
      const chunk = recipientChunks[chunkIndex];
      console.log(`📤 [Queue Processor] Sending chunk ${chunkIndex + 1}/${recipientChunks.length} (${chunk.length} emails)`);
      // PHASE 4 FIX: Check for cancellation INSIDE loop (mid-batch cancellation)
      const { data: currentJob, error: checkError } = await supabase.from('bulk_email_jobs').select('cancel_requested').eq('id', job.id).single();
      if (checkError) {
        console.error(`⚠️  [Queue Processor] Error checking cancellation status:`, checkError);
      } else if (currentJob?.cancel_requested) {
        console.log(`🛑 [Queue Processor] Job cancelled mid-batch at chunk ${chunkIndex + 1}/${recipientChunks.length}`);
        // bulk_email_recipients table already tracks what was sent — no array needed
        await supabase.from('bulk_email_jobs').update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          error_message: `Cancelled by administrator at chunk ${chunkIndex + 1}/${recipientChunks.length}`,
          processing_metadata: {
            ...job.processing_metadata,
            cancelled_at_chunk: chunkIndex
          }
        }).eq('id', job.id);
        return new Response(JSON.stringify({
          success: true,
          message: `Job cancelled mid-batch (processed ${chunkIndex}/${recipientChunks.length} chunks)`,
          job_id: job.id,
          chunks_processed: chunkIndex,
          total_chunks: recipientChunks.length
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
      // PHASE 4 FIX: Check timeout INSIDE loop (graceful timeout prevention)
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime >= MAX_EXECUTION_TIME_MS) {
        console.log(`⏱️  [Queue Processor] Approaching timeout limit (${elapsedTime}ms). Gracefully exiting...`);
        // bulk_email_recipients table already tracks progress — just reset status
        await supabase.from('bulk_email_jobs').update({
          status: 'queued',
          processing_metadata: {
            ...job.processing_metadata,
            timeout_prevention_triggered: true,
            stopped_at_chunk: chunkIndex
          },
          processing_worker_id: null,
          error_message: `Graceful timeout prevention at ${elapsedTime}ms`
        }).eq('id', job.id);
        return new Response(JSON.stringify({
          success: true,
          message: `Graceful timeout prevention triggered (${elapsedTime}ms)`,
          job_id: job.id,
          chunks_processed: chunkIndex,
          total_chunks: recipientChunks.length,
          will_auto_continue: true
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
      try {
        // PHASE 1: Generate unique idempotency key for this batch chunk
        // Format: team-{jobId}/chunk-{index}-{timestamp} (max 256 chars, stored for 24h by Resend)
        const idempotencyKey = `team-${job.id}/chunk-${chunkIndex}-${Date.now()}`;
        newIdempotencyKeys.push(idempotencyKey);
        console.log(`🔑 [Queue Processor] Using idempotency key: ${idempotencyKey}`);
        // Prepare batch emails with personalization and idempotency key
        const batchEmails = await Promise.all(chunk.map(async (recipient) => {
          const personalizedBody = personalizeContent(job.body, recipient);
          const wrappedBody = await wrapInProfessionalTemplate(personalizedBody, {
            title: emailSettings.platform_name || "ProfitChips",
            preheader: job.subject,
            headerGradient: true,
            includeFooter: true,
            platformName: emailSettings.platform_name || "ProfitChips",
            platformUrl: emailSettings.platform_url || "https://profitchips.com",
            supportUrl: `${emailSettings.platform_url || "https://profitchips.com"}/support`,
            privacyUrl: `${emailSettings.platform_url || "https://profitchips.com"}/privacy`,
            logoHtml: '',
          }, supabase);
          const textVersion = personalizedBody.replace(/<[^>]*>/g, "").trim();
          return {
            from: `${emailSettings.from_name} <${emailSettings.from_address}>`,
            to: [
              recipient.email
            ],
            subject: job.subject,
            html: wrappedBody,
            text: textVersion,
            reply_to: emailSettings.reply_to_address,
            headers: {
              "X-Entity-Ref-ID": `bulk-${job.batch_id}-${recipient.id}`,
              "Idempotency-Key": idempotencyKey
            }
          };
        }));

        // PHASE 2: Send batch using Resend Batch API with 429 retry logic
        const batchResponse = await retryWithBackoff(async ()=>await resend.batch.send(batchEmails), 3, 1000 // Start with 1s delay
        );
        // PHASE 3: Extract rate limit headers for monitoring
        // Note: Resend SDK may not expose headers directly; attempt extraction from response object
        const rateLimitHeaders = {
          limit: batchResponse?.response?.headers?.['ratelimit-limit'] || batchResponse?.headers?.['ratelimit-limit'] || 'unknown',
          remaining: batchResponse?.response?.headers?.['ratelimit-remaining'] || batchResponse?.headers?.['ratelimit-remaining'] || 'unknown',
          reset: batchResponse?.response?.headers?.['ratelimit-reset'] || batchResponse?.headers?.['ratelimit-reset'] || 'unknown'
        };
        console.log(`📊 [Queue Processor] Rate Limits - Limit: ${rateLimitHeaders.limit}, Remaining: ${rateLimitHeaders.remaining}, Reset: ${rateLimitHeaders.reset}`);
        // PHASE 3: Store rate limit metrics
        rateLimitMetrics.push({
          chunk_index: chunkIndex,
          timestamp: new Date().toISOString(),
          ...rateLimitHeaders
        });
        // Process batch response
        if (batchResponse.data) {
          console.log(`✅ [Queue Processor] Batch ${chunkIndex + 1} sent successfully`);
          // Log each email as sent
          // Resend batch API returns data as { data: { data: [...] } }
          const batchData = Array.isArray(batchResponse.data) ? batchResponse.data : batchResponse.data.data ? batchResponse.data.data : [];
          for(let i = 0; i < chunk.length; i++){
            const recipient = chunk[i];
            const emailData = batchData[i] || {};
            emailLogs.push({
              recipient_email: recipient.email,
              recipient_user_id: recipient.id,
              subject: job.subject,
              body: job.body,
              status: "sent",
              sent_at: new Date().toISOString(),
              sent_by: job.created_by,
              metadata: {
                resend_id: emailData?.id || `batch-${job.batch_id}-${chunkIndex}-${i}`,
                email_type: "bulk",
                batch_id: job.batch_id,
                job_id: job.id,
                chunk_index: chunkIndex,
                wrapped_in_template: true
              }
            });
            successCount++;
          }
        } else {
          throw new Error(batchResponse.error?.message || "Unknown batch send error");
        }
        // PHASE 4: Dynamic rate limiting - double delay if remaining requests are low
        if (chunkIndex < recipientChunks.length - 1) {
          const remaining = parseInt(rateLimitHeaders.remaining);
          let dynamicDelay = RATE_LIMIT_DELAY_MS;
          // Double the delay if we're close to rate limit (less than 2 remaining)
          if (!isNaN(remaining) && remaining < 2) {
            dynamicDelay = RATE_LIMIT_DELAY_MS * 2;
            console.log(`⚠️  [Queue Processor] Low rate limit remaining (${remaining}). Doubling delay to ${dynamicDelay}ms`);
          }
          console.log(`⏳ [Queue Processor] Rate limiting: waiting ${dynamicDelay}ms...`);
          await sleep(dynamicDelay);
        }
      } catch (error) {
        console.error(`❌ [Queue Processor] Batch ${chunkIndex + 1} failed after retries:`, error);
        // PHASE 2: Detect if final failure was due to 429
        const is429 = error?.status === 429 || error?.statusCode === 429 || error?.message?.includes('429') || error?.message?.toLowerCase().includes('rate limit');
        // Log failed emails with failure type
        for (const recipient of chunk){
          emailLogs.push({
            recipient_email: recipient.email,
            recipient_user_id: recipient.id,
            subject: job.subject,
            body: job.body,
            status: "failed",
            error_message: error.message,
            sent_by: job.created_by,
            metadata: {
              email_type: "bulk",
              batch_id: job.batch_id,
              job_id: job.id,
              chunk_index: chunkIndex,
              failure_type: is429 ? 'rate_limit_429' : 'other',
              retries_exhausted: true
            }
          });
          failCount++;
        }
      }
    }
    // FIX: Update recipient status in bulk_email_recipients table (replaces JSONB array tracking)
    // This is the source of truth for deduplication — no more URL-bloating sent_ids arrays.
    if (emailLogs.length > 0) {
      console.log(`💾 [Queue Processor] Updating ${emailLogs.length} recipient statuses in DB...`);
      const recipientStatusUpdates = emailLogs.map((log) => ({
        job_id: job.id,
        user_id: log.recipient_user_id,
        status: log.status,                                                    // 'sent' or 'failed'
        sent_at: log.status === 'sent' ? new Date().toISOString() : null,
        error_message: log.error_message || null,
      }));
      const { error: recipientUpdateError } = await supabase
        .from('bulk_email_recipients')
        .upsert(recipientStatusUpdates, { onConflict: 'job_id,user_id' });
      if (recipientUpdateError) {
        console.error(`⚠️  [Queue Processor] Failed to update recipient statuses:`, recipientUpdateError);
        // Non-fatal: pending rows already prevent re-sends on retry
      } else {
        console.log(`✅ [Queue Processor] Recipient statuses updated successfully`);
      }
    }
    // FIX: Completion check — ask the DB if any unsent recipients remain (works at any scale)
    const { data: remainingCheck, error: remainingError } = await supabase.rpc(
      'get_bulk_email_next_batch',
      { p_job_id: job.id, p_batch_size: 1 }
    );
    const isComplete = !remainingError && (!remainingCheck || remainingCheck.length === 0);
    console.log(`📊 [Queue Processor] Progress: sent=${successCount}, failed=${failCount}, isComplete=${isComplete}`);
    if (remainingError) {
      console.error(`⚠️  [Queue Processor] Could not check remaining recipients:`, remainingError);
    }
    // Save lean metadata (no more giant sent_ids arrays)
    const metadataUpdateData = {
      last_processed_at: new Date().toISOString(),
      last_heartbeat: new Date().toISOString(),
      processing_metadata: {
        rate_limit_metrics: rateLimitMetrics,
        last_batch_size: recipients.length,
        last_chunk_count: recipientChunks.length,
        last_batch_timestamp: new Date().toISOString(),
        execution_time_ms: Date.now() - startTime,
        worker_id: workerId
      }
    };
    const { error: metadataError } = await supabase.from("bulk_email_jobs").update(metadataUpdateData).eq("id", job.id);
    if (metadataError) {
      console.error(`⚠️  [Queue Processor] Failed to save metadata:`, metadataError);
    } else {
      console.log(`✅ [Queue Processor] Metadata saved`);
    }
    // STEP 8: Insert email logs in bulk (CRITICAL: This triggers auto-count update)
    if (emailLogs.length > 0) {
      console.log(`📝 [Queue Processor] Logging ${emailLogs.length} emails...`);
      console.log(`🔧 [Queue Processor] Database trigger will auto-update counts based on email_logs`);
      const { error: logError } = await supabase.from("email_logs").insert(emailLogs);
      if (logError) {
        console.error(`⚠️  [Queue Processor] Error logging emails:`, logError);
      // Don't throw - metadata is already saved, counts will sync on next run
      } else {
        console.log(`✅ [Queue Processor] Email logs inserted. Counts auto-updated by trigger.`);
      }
    }
    // STEP 9: Update completion status if needed
    const finalUpdateData = {
      last_heartbeat: new Date().toISOString()
    };
    // Mark as completed if all recipients processed
    if (isComplete) {
      finalUpdateData.status = "completed";
      finalUpdateData.completed_at = new Date().toISOString();
      console.log(`🎉 [Queue Processor] Job completed! All ${job.total_recipients} recipients processed.`);
    }
    // Clear worker ID after batch (prevents stuck jobs)
    finalUpdateData.processing_worker_id = null;
    const { error: finalUpdateError } = await supabase.from("bulk_email_jobs").update(finalUpdateData).eq("id", job.id);
    if (finalUpdateError) {
      console.error(`❌ [Queue Processor] Error updating final job status:`, finalUpdateError);
    } else {
      console.log(`✅ [Queue Processor] Final job status updated successfully`);
    }
    const executionTime = Date.now() - startTime;
    console.log(`✅ [Queue Processor] Batch complete in ${executionTime}ms`);
    console.log(`📧 [Queue Processor] Sent: ${successCount}, Failed: ${failCount}`);
    console.log(`📊 [Queue Processor] Database trigger has auto-synced counts from email_logs`);
    // Self-continuation for large jobs (DB tracks progress, not arrays)
    const shouldContinue = !isComplete && successCount > 0;
    if (shouldContinue) {
      console.log(`🔄 [Self-Continuation] Job not complete. Triggering continuation...`);
      // PHASE 4 FIX: Use immediate invocation instead of setTimeout for reliability
      // setTimeout can fail if the edge function terminates before the timeout fires
      try {
        console.log(`🚀 [Self-Continuation] Immediately invoking next batch (no delay)...`);
        // Use waitUntil to ensure continuation happens even if function terminates
        const continuationPromise = supabase.functions.invoke('process-bulk-email-queue', {
          body: {},
          headers: {
            'X-Continuation-Trigger': 'auto',
            'X-Parent-Worker-Id': workerId,
            'X-Job-Id': job.id
          }
        }).then((response)=>{
          if (response.error) {
            console.error(`❌ [Self-Continuation] Failed to trigger continuation:`, response.error);
          } else {
            console.log(`✅ [Self-Continuation] Successfully triggered next batch processing`);
          }
        }).catch((error)=>{
          console.error(`❌ [Self-Continuation] Error during continuation:`, error);
        });
        // Use EdgeRuntime.waitUntil if available (Deno Deploy feature)
        const edgeRuntime = globalThis.EdgeRuntime;
        if (edgeRuntime && typeof edgeRuntime.waitUntil === 'function') {
          edgeRuntime.waitUntil(continuationPromise);
          console.log(`✅ [Self-Continuation] Continuation registered with EdgeRuntime.waitUntil`);
        } else {
          // Fallback: Fire and forget (already invoked above)
          console.log(`⚠️  [Self-Continuation] EdgeRuntime.waitUntil not available, using fire-and-forget`);
        }
      } catch (error) {
        console.error(`❌ [Self-Continuation] Failed to trigger continuation:`, error);
      }
      console.log(`✅ [Self-Continuation] Continuation triggered. Returning current batch results.`);
    } else if (isComplete) {
      console.log(`🎉 [Self-Continuation] Job fully complete. No continuation needed.`);
    } else {
      console.log(`⚠️  [Self-Continuation] Skipped: successCount=${successCount}, total_recipients=${job.total_recipients}`);
    }
    return new Response(JSON.stringify({
      success: true,
      message: "Batch processed successfully",
      job_id: job.id,
      batch_id: job.batch_id,
      total_recipients: job.total_recipients,
      successful_count: (job.successful_count || 0) + successCount,
      failed_count: (job.failed_count || 0) + failCount,
      is_complete: isComplete,
      execution_time_ms: executionTime,
      continuation_scheduled: shouldContinue,
      note: "Deduplication via bulk_email_recipients table (URL-safe, scales to 10M users)"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error(`❌ [Queue Processor] Fatal error:`, error);
    // PHASE 5 FIX: On fatal error, increment retry count and reset job with exponential backoff
    try {
      // Try to get job ID from context (if we got past job fetching)
      const jobId = error.jobId;
      if (jobId) {
        console.log(`🔄 [Queue Processor] Attempting to reset job ${jobId} after fatal error`);
        // Fetch current job state
        const { data: failedJob } = await (async ()=>{
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          return await supabase.from('bulk_email_jobs').select('id, retry_count, max_retries, processing_metadata').eq('id', jobId).single();
        })();
        if (failedJob) {
          const retryCount = failedJob.retry_count || 0;
          const maxRetries = failedJob.max_retries || 3;
          const newRetryCount = retryCount + 1;
          if (newRetryCount >= maxRetries) {
            console.error(`❌ [Queue Processor] Job ${jobId} reached max retries (${newRetryCount}/${maxRetries}), marking as permanently failed`);
            const supabase = createClient(supabaseUrl, supabaseServiceKey);
            await supabase.from('bulk_email_jobs').update({
              status: 'failed',
              retry_count: newRetryCount,
              processing_worker_id: null,
              last_heartbeat: null,
              completed_at: new Date().toISOString(),
              error_message: `Job failed after ${newRetryCount} retry attempts: ${error.message}`,
              processing_metadata: {
                ...failedJob.processing_metadata,
                last_error: error.message,
                last_error_timestamp: new Date().toISOString(),
                retry_limit_reached: true,
                final_retry_count: newRetryCount
              }
            }).eq('id', jobId);
          } else {
            const nextRetryAt = calculateNextRetryAt(newRetryCount);
            const delayMinutes = Math.round(calculateRetryDelay(newRetryCount) / 1000 / 60);
            console.log(`🔄 [Queue Processor] Job ${jobId} will retry in ${delayMinutes} minutes (attempt ${newRetryCount}/${maxRetries})`);
            console.log(`📅 [Queue Processor] Next retry scheduled for: ${nextRetryAt}`);
            const supabase = createClient(supabaseUrl, supabaseServiceKey);
            await supabase.from('bulk_email_jobs').update({
              status: 'queued',
              retry_count: newRetryCount,
              next_retry_at: nextRetryAt,
              processing_worker_id: null,
              last_heartbeat: null,
              error_message: `Worker error (retry ${newRetryCount}/${maxRetries} in ${delayMinutes}min): ${error.message}`,
              processing_metadata: {
                ...failedJob.processing_metadata,
                last_error: error.message,
                last_error_timestamp: new Date().toISOString(),
                auto_reset_for_retry: true,
                retry_count: newRetryCount,
                retry_delay_minutes: delayMinutes
              }
            }).eq('id', jobId);
            console.log(`✅ [Queue Processor] Job ${jobId} reset with exponential backoff (${delayMinutes}min delay)`);
          }
        }
      }
    } catch (resetError) {
      console.error(`❌ [Queue Processor] Failed to reset job after fatal error:`, resetError);
    }
    return new Response(JSON.stringify({
      error: error.message,
      details: "Queue processor encountered an error"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
};
serve(handler);
