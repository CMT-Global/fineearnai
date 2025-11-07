import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { wrapInProfessionalTemplate } from "../_shared/email-template-wrapper.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BATCH_SIZE = 500; // Process 500 recipients per cycle
const RESEND_BATCH_LIMIT = 100; // Resend allows 100 emails per batch API call
const RATE_LIMIT_DELAY_MS = 500; // 500ms delay between batch API calls
const MAX_EXECUTION_TIME_MS = 4 * 60 * 1000; // 4 minutes (safe buffer before 5min timeout)
const CONTINUATION_DELAY_MS = 2000; // 2 second delay before triggering continuation

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper: Sleep function for rate limiting
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Personalize email content
const personalizeContent = (content: string, recipient: any): string => {
  return content
    .replace(/\{\{username\}\}/g, recipient.username || 'User')
    .replace(/\{\{email\}\}/g, recipient.email || '')
    .replace(/\{\{full_name\}\}/g, recipient.full_name || recipient.username || 'User');
};

// Helper: Split array into chunks
const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

// PHASE 2: Helper - Retry with exponential backoff for 429 errors
const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a 429 rate limit error
      const is429 = error?.status === 429 || 
                    error?.statusCode === 429 || 
                    error?.message?.includes('429') ||
                    error?.message?.toLowerCase().includes('rate limit');
      
      if (!is429 || attempt === maxRetries - 1) {
        // Not a rate limit error or last attempt, throw immediately
        throw error;
      }
      
      // Extract retry-after header if available (in seconds)
      const retryAfter = error?.headers?.['retry-after'] || 
                        error?.response?.headers?.['retry-after'];
      
      // Calculate delay: use retry-after if provided, otherwise exponential backoff
      const delay = retryAfter 
        ? parseInt(retryAfter) * 1000 
        : initialDelay * Math.pow(2, attempt);
      
      console.log(`⚠️  [429 Rate Limit] Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delay}ms...`);
      if (retryAfter) {
        console.log(`🔄 [429 Rate Limit] Using retry-after header: ${retryAfter}s`);
      }
      
      await sleep(delay);
    }
  }
  
  throw lastError;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const startTime = Date.now();
    
    // Generate unique worker ID for this execution
    const workerId = `worker_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    console.log(`🔧 [Queue Processor] Worker ID: ${workerId}`);

    console.log(`🔄 [Queue Processor] Starting bulk email queue processor...`);

    // STEP 1: Fetch next job with locking (prevents race conditions)
    const { data: jobs, error: jobError } = await supabase
      .rpc("get_next_bulk_email_job");

    if (jobError) {
      console.error(`❌ [Queue Processor] Error fetching jobs:`, jobError);
      throw jobError;
    }

    if (!jobs || jobs.length === 0) {
      console.log(`✅ [Queue Processor] No jobs in queue. Exiting.`);
      return new Response(
        JSON.stringify({ success: true, message: "No jobs in queue" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const job = jobs[0];
    console.log(`📧 [Queue Processor] Processing job: ${job.id} (Batch: ${job.batch_id})`);
    console.log(`📊 [Queue Processor] Progress: ${job.processed_count}/${job.total_recipients}`);

    // STEP 2: Mark job as processing with worker ID and heartbeat
    if (job.status === "queued") {
      const { error: updateError } = await supabase
        .from("bulk_email_jobs")
        .update({
          status: "processing",
          started_at: new Date().toISOString(),
          processing_worker_id: workerId,
          last_heartbeat: new Date().toISOString(),
        })
        .eq("id", job.id);
        
      if (updateError) {
        console.error(`❌ [Queue Processor] Failed to mark job as processing:`, updateError);
        throw updateError;
      }
      console.log(`▶️  [Queue Processor] Job marked as processing by ${workerId}`);
    } else {
      // Update heartbeat for already processing job
      await supabase
        .from("bulk_email_jobs")
        .update({ 
          last_heartbeat: new Date().toISOString(),
          processing_worker_id: workerId 
        })
        .eq("id", job.id);
      console.log(`💓 [Queue Processor] Heartbeat updated for job ${job.id}`);
    }

    // PHASE 2: Initialize duplicate prevention tracking
    const existingSentIds = job.processing_metadata?.sent_recipient_ids || [];
    console.log(`📋 [Queue Processor] Already sent to ${existingSentIds.length} recipients`);
    
    // PHASE 1: Initialize idempotency keys tracking
    const usedIdempotencyKeys = job.processing_metadata?.idempotency_keys_used || [];
    console.log(`🔑 [Queue Processor] Tracking ${usedIdempotencyKeys.length} used idempotency keys`);

    // STEP 3: Fetch dynamic email settings
    console.log(`⚙️  [Queue Processor] Fetching email settings...`);
    const { data: configData } = await supabase
      .from("platform_config")
      .select("value")
      .eq("key", "email_settings")
      .maybeSingle();

    const emailSettings = configData?.value || {
      from_address: "noreply@mail.fineearn.com",
      from_name: "FineEarn",
      reply_to_address: "support@fineearn.com",
    };

    console.log(`✅ [Queue Processor] Using settings - From: ${emailSettings.from_name} <${emailSettings.from_address}>`);

    // STEP 4: Build recipient query based on filter
    const recipientFilter = job.recipient_filter;
    let recipientsQuery = supabase.from("profiles").select("id, email, username, full_name");

    if (recipientFilter.type === "plan" && recipientFilter.plan) {
      recipientsQuery = recipientsQuery.eq("membership_plan", recipientFilter.plan);
    } else if (recipientFilter.type === "country" && recipientFilter.country) {
      recipientsQuery = recipientsQuery.eq("country", recipientFilter.country);
    } else if (recipientFilter.type === "usernames" && recipientFilter.usernames) {
      recipientsQuery = recipientsQuery.in("username", recipientFilter.usernames);
    }

    // PHASE 2 FIX: Exclude already-sent recipients to prevent duplicates on retry
    if (existingSentIds.length > 0) {
      console.log(`🔒 [Queue Processor] Excluding ${existingSentIds.length} already-sent recipients`);
      recipientsQuery = recipientsQuery.not("id", "in", `(${existingSentIds.join(",")})`);
    }

    // PHASE 2 FIX: Fetch next batch WITHOUT offset since exclusion handles processed recipients
    // The NOT IN clause naturally skips processed recipients, so we always fetch the "next" batch
    recipientsQuery = recipientsQuery.limit(BATCH_SIZE);

    console.log(`📥 [Queue Processor] Fetching next ${BATCH_SIZE} unprocessed recipients (${existingSentIds.length} already sent)`);
    const { data: recipients, error: recipientsError } = await recipientsQuery;

    if (recipientsError) {
      console.error(`❌ [Queue Processor] Error fetching recipients:`, recipientsError);
      await supabase
        .from("bulk_email_jobs")
        .update({
          status: "failed",
          error_message: `Failed to fetch recipients: ${recipientsError.message}`,
        })
        .eq("id", job.id);
      throw recipientsError;
    }

    if (!recipients || recipients.length === 0) {
      console.log(`✅ [Queue Processor] No more recipients. Marking job as completed.`);
      await supabase
        .from("bulk_email_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          last_processed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Job completed",
          job_id: job.id,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`📨 [Queue Processor] Processing ${recipients.length} recipients`);

    // Check for cancellation request before processing
    if (job.cancel_requested) {
      console.log(`🛑 [Queue Processor] Job cancelled by admin. Stopping.`);
      await supabase
        .from("bulk_email_jobs")
        .update({
          status: "cancelled",
          completed_at: new Date().toISOString(),
          error_message: "Cancelled by administrator",
        })
        .eq("id", job.id);
      
      return new Response(
        JSON.stringify({ success: true, message: "Job cancelled", job_id: job.id }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // STEP 6: Split recipients into chunks of 100 for Resend Batch API
    const recipientChunks = chunkArray(recipients, RESEND_BATCH_LIMIT);
    console.log(`📦 [Queue Processor] Split into ${recipientChunks.length} chunks of max ${RESEND_BATCH_LIMIT}`);

    let successCount = 0;
    let failCount = 0;
    const emailLogs: any[] = [];
    const newIdempotencyKeys: string[] = []; // PHASE 1: Track new idempotency keys
    const rateLimitMetrics: any[] = []; // PHASE 3: Track rate limit metrics per batch

    // STEP 7: Process each chunk with Resend Batch API
    for (let chunkIndex = 0; chunkIndex < recipientChunks.length; chunkIndex++) {
      const chunk = recipientChunks[chunkIndex];
      console.log(`📤 [Queue Processor] Sending chunk ${chunkIndex + 1}/${recipientChunks.length} (${chunk.length} emails)`);

      // PHASE 4 FIX: Check for cancellation INSIDE loop (mid-batch cancellation)
      const { data: currentJob, error: checkError } = await supabase
        .from('bulk_email_jobs')
        .select('cancel_requested')
        .eq('id', job.id)
        .single();

      if (checkError) {
        console.error(`⚠️  [Queue Processor] Error checking cancellation status:`, checkError);
      } else if (currentJob?.cancel_requested) {
        console.log(`🛑 [Queue Processor] Job cancelled mid-batch at chunk ${chunkIndex + 1}/${recipientChunks.length}`);
        
        // Save progress before exiting
        const partialSentIds = recipients.slice(0, chunkIndex * RESEND_BATCH_LIMIT).map(r => r.id);
        const allPartialSentIds = [...existingSentIds, ...partialSentIds];
        
        await supabase
          .from('bulk_email_jobs')
          .update({
            status: 'cancelled',
            completed_at: new Date().toISOString(),
            error_message: `Cancelled by administrator at chunk ${chunkIndex + 1}/${recipientChunks.length}`,
            processing_metadata: {
              ...job.processing_metadata,
              sent_recipient_ids: allPartialSentIds,
              cancelled_at_chunk: chunkIndex,
            },
          })
          .eq('id', job.id);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Job cancelled mid-batch (processed ${chunkIndex}/${recipientChunks.length} chunks)`,
            job_id: job.id,
            chunks_processed: chunkIndex,
            total_chunks: recipientChunks.length,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // PHASE 4 FIX: Check timeout INSIDE loop (graceful timeout prevention)
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime >= MAX_EXECUTION_TIME_MS) {
        console.log(`⏱️  [Queue Processor] Approaching timeout limit (${elapsedTime}ms). Gracefully exiting...`);
        
        // Save progress before exiting
        const partialSentIds = recipients.slice(0, chunkIndex * RESEND_BATCH_LIMIT).map(r => r.id);
        const allPartialSentIds = [...existingSentIds, ...partialSentIds];
        
        await supabase
          .from('bulk_email_jobs')
          .update({
            status: 'queued', // Re-queue for next worker to pick up
            processing_metadata: {
              ...job.processing_metadata,
              sent_recipient_ids: allPartialSentIds,
              timeout_prevention_triggered: true,
              stopped_at_chunk: chunkIndex,
            },
            processing_worker_id: null,
            error_message: `Graceful timeout prevention at ${elapsedTime}ms`,
          })
          .eq('id', job.id);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Graceful timeout prevention triggered (${elapsedTime}ms)`,
            job_id: job.id,
            chunks_processed: chunkIndex,
            total_chunks: recipientChunks.length,
            will_auto_continue: true,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      try {
        // PHASE 1: Generate unique idempotency key for this batch chunk
        // Format: team-{jobId}/chunk-{index}-{timestamp} (max 256 chars, stored for 24h by Resend)
        const idempotencyKey = `team-${job.id}/chunk-${chunkIndex}-${Date.now()}`;
        newIdempotencyKeys.push(idempotencyKey);
        console.log(`🔑 [Queue Processor] Using idempotency key: ${idempotencyKey}`);

        // Prepare batch emails with personalization and idempotency key
        const batchEmails = chunk.map((recipient) => {
          const personalizedBody = personalizeContent(job.body, recipient);
          const wrappedBody = wrapInProfessionalTemplate(personalizedBody, {
            title: "FineEarn",
            preheader: job.subject,
            headerGradient: true,
            includeFooter: true,
          });
          const textVersion = personalizedBody.replace(/<[^>]*>/g, "").trim();

          return {
            from: `${emailSettings.from_name} <${emailSettings.from_address}>`,
            to: [recipient.email],
            subject: job.subject,
            html: wrappedBody,
            text: textVersion,
            reply_to: emailSettings.reply_to_address,
            headers: {
              "X-Entity-Ref-ID": `bulk-${job.batch_id}-${recipient.id}`,
              "Idempotency-Key": idempotencyKey, // PHASE 1: Prevent duplicate sends on retry
            },
          };
        });

        // PHASE 2: Send batch using Resend Batch API with 429 retry logic
        const batchResponse = await retryWithBackoff(
          async () => await resend.batch.send(batchEmails),
          3, // Max 3 retries
          1000 // Start with 1s delay
        );

        // PHASE 3: Extract rate limit headers for monitoring
        // Note: Resend SDK may not expose headers directly; attempt extraction from response object
        const rateLimitHeaders = {
          limit: (batchResponse as any)?.response?.headers?.['ratelimit-limit'] || 
                 (batchResponse as any)?.headers?.['ratelimit-limit'] || 'unknown',
          remaining: (batchResponse as any)?.response?.headers?.['ratelimit-remaining'] || 
                     (batchResponse as any)?.headers?.['ratelimit-remaining'] || 'unknown',
          reset: (batchResponse as any)?.response?.headers?.['ratelimit-reset'] || 
                 (batchResponse as any)?.headers?.['ratelimit-reset'] || 'unknown',
        };

        console.log(`📊 [Queue Processor] Rate Limits - Limit: ${rateLimitHeaders.limit}, Remaining: ${rateLimitHeaders.remaining}, Reset: ${rateLimitHeaders.reset}`);

        // PHASE 3: Store rate limit metrics
        rateLimitMetrics.push({
          chunk_index: chunkIndex,
          timestamp: new Date().toISOString(),
          ...rateLimitHeaders,
        });

        // Process batch response
        if (batchResponse.data) {
          console.log(`✅ [Queue Processor] Batch ${chunkIndex + 1} sent successfully`);
          
          // Log each email as sent
          // Resend batch API returns data as { data: { data: [...] } }
          const batchData = Array.isArray(batchResponse.data) ? batchResponse.data : 
                           (batchResponse.data as any).data ? (batchResponse.data as any).data : [];
          
          for (let i = 0; i < chunk.length; i++) {
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
                wrapped_in_template: true,
              },
            });
            successCount++;
          }
        } else {
          throw new Error((batchResponse as any).error?.message || "Unknown batch send error");
        }

        // PHASE 4: Dynamic rate limiting - double delay if remaining requests are low
        if (chunkIndex < recipientChunks.length - 1) {
          const remaining = parseInt(rateLimitHeaders.remaining as string);
          let dynamicDelay = RATE_LIMIT_DELAY_MS;
          
          // Double the delay if we're close to rate limit (less than 2 remaining)
          if (!isNaN(remaining) && remaining < 2) {
            dynamicDelay = RATE_LIMIT_DELAY_MS * 2;
            console.log(`⚠️  [Queue Processor] Low rate limit remaining (${remaining}). Doubling delay to ${dynamicDelay}ms`);
          }
          
          console.log(`⏳ [Queue Processor] Rate limiting: waiting ${dynamicDelay}ms...`);
          await sleep(dynamicDelay);
        }
      } catch (error: any) {
        console.error(`❌ [Queue Processor] Batch ${chunkIndex + 1} failed after retries:`, error);
        
        // PHASE 2: Detect if final failure was due to 429
        const is429 = error?.status === 429 || 
                      error?.statusCode === 429 || 
                      error?.message?.includes('429') ||
                      error?.message?.toLowerCase().includes('rate limit');
        
        // Log failed emails with failure type
        for (const recipient of chunk) {
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
              failure_type: is429 ? 'rate_limit_429' : 'other', // PHASE 2: Track 429 failures
              retries_exhausted: true,
            },
          });
          failCount++;
        }
      }
    }

    // PHASE 1 FIX: Track duplicate prevention data BEFORE inserting logs
    const newlySentIds = recipients.map(r => r.id);
    const allSentIds = [...existingSentIds, ...newlySentIds];
    console.log(`📊 [Queue Processor] Tracking sent IDs: previously=${existingSentIds.length}, new=${newlySentIds.length}, total=${allSentIds.length}`);
    
    const allIdempotencyKeys = [...usedIdempotencyKeys, ...newIdempotencyKeys];
    console.log(`🔑 [Queue Processor] Idempotency keys: previously=${usedIdempotencyKeys.length}, new=${newIdempotencyKeys.length}, total=${allIdempotencyKeys.length}`);

    // PHASE 2 FIX: Calculate completion based on total sent (not offset-based processed_count)
    // The trigger will sync the counts, but we determine completion by checking if all recipients are in the sent list
    const isComplete = allSentIds.length >= job.total_recipients;

    console.log(`📊 [Queue Processor] Progress Calculation:`);
    console.log(`   - Total sent IDs tracked: ${allSentIds.length}`);
    console.log(`   - Total recipients: ${job.total_recipients}`);
    console.log(`   - Is complete: ${isComplete}`);

    // PHASE 4 FIX: Update metadata BEFORE inserting logs (prevent duplicate sends if logs insert fails)
    const metadataUpdateData: any = {
      last_processed_at: new Date().toISOString(),
      last_heartbeat: new Date().toISOString(),
      processing_metadata: {
        sent_recipient_ids: allSentIds, // CRITICAL: Save this FIRST to prevent duplicates
        idempotency_keys_used: allIdempotencyKeys,
        rate_limit_metrics: rateLimitMetrics,
        last_batch_size: recipients.length,
        last_chunk_count: recipientChunks.length,
        last_batch_timestamp: new Date().toISOString(),
        execution_time_ms: Date.now() - startTime,
        worker_id: workerId,
      },
    };

    console.log(`💾 [Queue Processor] Saving metadata BEFORE email logs insert...`);
    const { error: metadataError } = await supabase
      .from("bulk_email_jobs")
      .update(metadataUpdateData)
      .eq("id", job.id);

    if (metadataError) {
      console.error(`❌ [Queue Processor] CRITICAL: Failed to save metadata:`, metadataError);
      throw new Error(`Failed to save sent_recipient_ids: ${metadataError.message}`);
    } else {
      console.log(`✅ [Queue Processor] Metadata saved successfully (${allSentIds.length} sent IDs tracked)`);
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
    const finalUpdateData: any = {
      last_heartbeat: new Date().toISOString(),
    };

    // Mark as completed if all recipients processed
    if (isComplete) {
      finalUpdateData.status = "completed";
      finalUpdateData.completed_at = new Date().toISOString();
      console.log(`🎉 [Queue Processor] Job completed! All ${job.total_recipients} recipients processed.`);
    }
    
    // Clear worker ID after batch (prevents stuck jobs)
    finalUpdateData.processing_worker_id = null;

    const { error: finalUpdateError } = await supabase
      .from("bulk_email_jobs")
      .update(finalUpdateData)
      .eq("id", job.id);

    if (finalUpdateError) {
      console.error(`❌ [Queue Processor] Error updating final job status:`, finalUpdateError);
    } else {
      console.log(`✅ [Queue Processor] Final job status updated successfully`);
    }

    const executionTime = Date.now() - startTime;
    console.log(`✅ [Queue Processor] Batch complete in ${executionTime}ms`);
    console.log(`📧 [Queue Processor] Sent: ${successCount}, Failed: ${failCount}`);
    console.log(`📊 [Queue Processor] Database trigger has auto-synced counts from email_logs`);

    // PHASE 3: Self-continuation for large jobs
    const shouldContinue = !isComplete && 
                          successCount > 0 && 
                          allSentIds.length < job.total_recipients;
    
    if (shouldContinue) {
      console.log(`🔄 [Self-Continuation] Job not complete. Triggering continuation...`);
      console.log(`📊 [Self-Continuation] Progress: ${allSentIds.length}/${job.total_recipients} (${Math.round(allSentIds.length / job.total_recipients * 100)}%)`);
      
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
            'X-Job-Id': job.id,
          }
        }).then((response) => {
          if (response.error) {
            console.error(`❌ [Self-Continuation] Failed to trigger continuation:`, response.error);
          } else {
            console.log(`✅ [Self-Continuation] Successfully triggered next batch processing`);
          }
        }).catch((error: any) => {
          console.error(`❌ [Self-Continuation] Error during continuation:`, error);
        });
        
        // Use EdgeRuntime.waitUntil if available (Deno Deploy feature)
        const edgeRuntime = (globalThis as any).EdgeRuntime;
        if (edgeRuntime && typeof edgeRuntime.waitUntil === 'function') {
          edgeRuntime.waitUntil(continuationPromise);
          console.log(`✅ [Self-Continuation] Continuation registered with EdgeRuntime.waitUntil`);
        } else {
          // Fallback: Fire and forget (already invoked above)
          console.log(`⚠️  [Self-Continuation] EdgeRuntime.waitUntil not available, using fire-and-forget`);
        }
      } catch (error: any) {
        console.error(`❌ [Self-Continuation] Failed to trigger continuation:`, error);
      }
      
      console.log(`✅ [Self-Continuation] Continuation triggered. Returning current batch results.`);
    } else if (isComplete) {
      console.log(`🎉 [Self-Continuation] Job fully complete. No continuation needed.`);
    } else {
      console.log(`⚠️  [Self-Continuation] Skipped: successCount=${successCount}, remaining=${job.total_recipients - allSentIds.length}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Batch processed successfully",
        job_id: job.id,
        batch_id: job.batch_id,
        processed_count: allSentIds.length, // Total sent recipients tracked
        total_recipients: job.total_recipients,
        successful_count: (job.successful_count || 0) + successCount,
        failed_count: (job.failed_count || 0) + failCount,
        is_complete: isComplete,
        execution_time_ms: executionTime,
        continuation_scheduled: shouldContinue,
        note: "Counts auto-synced by database trigger from email_logs",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error(`❌ [Queue Processor] Fatal error:`, error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: "Queue processor encountered an error"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
