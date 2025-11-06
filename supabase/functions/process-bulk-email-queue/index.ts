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

    // STEP 5: Fetch batch of 500 recipients using OFFSET pagination
    const offset = job.processed_count || 0;
    recipientsQuery = recipientsQuery.range(offset, offset + BATCH_SIZE - 1);

    console.log(`📥 [Queue Processor] Fetching recipients: offset ${offset}, limit ${BATCH_SIZE}`);
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

    // STEP 7: Process each chunk with Resend Batch API
    for (let chunkIndex = 0; chunkIndex < recipientChunks.length; chunkIndex++) {
      const chunk = recipientChunks[chunkIndex];
      console.log(`📤 [Queue Processor] Sending chunk ${chunkIndex + 1}/${recipientChunks.length} (${chunk.length} emails)`);

      try {
        // Prepare batch emails with personalization
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
            },
          };
        });

        // Send batch using Resend Batch API
        const batchResponse = await resend.batch.send(batchEmails);

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

        // Rate limiting: Wait 500ms before next batch (respects Resend's 2 req/sec limit)
        if (chunkIndex < recipientChunks.length - 1) {
          console.log(`⏳ [Queue Processor] Rate limiting: waiting ${RATE_LIMIT_DELAY_MS}ms...`);
          await sleep(RATE_LIMIT_DELAY_MS);
        }
      } catch (error: any) {
        console.error(`❌ [Queue Processor] Batch ${chunkIndex + 1} failed:`, error);
        
        // Log failed emails
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
            },
          });
          failCount++;
        }
      }
    }

    // STEP 8: Insert email logs in bulk
    if (emailLogs.length > 0) {
      console.log(`📝 [Queue Processor] Logging ${emailLogs.length} emails...`);
      const { error: logError } = await supabase.from("email_logs").insert(emailLogs);
      if (logError) {
        console.error(`⚠️  [Queue Processor] Error logging emails:`, logError);
      }
    }

    // STEP 9: Update job progress
    const newProcessedCount = (job.processed_count || 0) + recipients.length;
    const newSuccessfulCount = (job.successful_count || 0) + successCount;
    const newFailedCount = (job.failed_count || 0) + failCount;
    const isComplete = newProcessedCount >= job.total_recipients;

    console.log(`📊 [Queue Processor] Progress Update:`);
    console.log(`   - Processed: ${newProcessedCount}/${job.total_recipients}`);
    console.log(`   - Successful: ${newSuccessfulCount}`);
    console.log(`   - Failed: ${newFailedCount}`);
    console.log(`   - Status: ${isComplete ? "COMPLETED" : "PROCESSING"}`);

    const updateData: any = {
      processed_count: newProcessedCount,
      successful_count: newSuccessfulCount,
      failed_count: newFailedCount,
      last_processed_at: new Date().toISOString(),
      last_heartbeat: new Date().toISOString(), // Update heartbeat
      processing_metadata: {
        last_batch_size: recipients.length,
        last_chunk_count: recipientChunks.length,
        execution_time_ms: Date.now() - startTime,
        worker_id: workerId,
      },
    };

    if (isComplete) {
      updateData.status = "completed";
      updateData.completed_at = new Date().toISOString();
    }
    
    // CRITICAL: Always clear worker ID after batch, regardless of completion status
    // This prevents jobs from getting stuck when processing multiple batches
    updateData.processing_worker_id = null;

    const { error: updateError } = await supabase
      .from("bulk_email_jobs")
      .update(updateData)
      .eq("id", job.id);

    if (updateError) {
      console.error(`❌ [Queue Processor] Error updating job progress:`, updateError);
    }

    const executionTime = Date.now() - startTime;
    console.log(`✅ [Queue Processor] Batch complete in ${executionTime}ms`);
    console.log(`📧 [Queue Processor] Sent: ${successCount}, Failed: ${failCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Batch processed successfully",
        job_id: job.id,
        batch_id: job.batch_id,
        processed_count: newProcessedCount,
        total_recipients: job.total_recipients,
        successful_count: newSuccessfulCount,
        failed_count: newFailedCount,
        is_complete: isComplete,
        execution_time_ms: executionTime,
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
