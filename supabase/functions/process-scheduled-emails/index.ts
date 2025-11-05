import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[SCHEDULED-EMAILS] Starting scheduled email processing...");

    // Get all pending scheduled emails that are due
    const now = new Date().toISOString();
    const { data: scheduledEmails, error: fetchError } = await supabase
      .from("scheduled_emails")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", now)
      .order("scheduled_for", { ascending: true })
      .limit(50); // Process up to 50 emails per run

    if (fetchError) {
      console.error("[SCHEDULED-EMAILS] Error fetching scheduled emails:", fetchError);
      throw fetchError;
    }

    if (!scheduledEmails || scheduledEmails.length === 0) {
      console.log("[SCHEDULED-EMAILS] No scheduled emails to process");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No scheduled emails to process",
          processed: 0,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`[SCHEDULED-EMAILS] Found ${scheduledEmails.length} scheduled emails to process`);

    let processedCount = 0;
    let failedCount = 0;

    // Process each scheduled email
    for (const scheduledEmail of scheduledEmails) {
      try {
        console.log(`[SCHEDULED-EMAILS] Processing email ID: ${scheduledEmail.id}`);

        // Mark as processing
        await supabase
          .from("scheduled_emails")
          .update({ status: "processing" })
          .eq("id", scheduledEmail.id);

        // Parse recipient filter
        const filter = scheduledEmail.recipient_filter as any;
        let query = supabase.from("profiles").select("email, username, id, full_name");

        // Apply filters
        if (filter.type === "plan" && filter.plan) {
          query = query.eq("membership_plan", filter.plan);
        } else if (filter.type === "country" && filter.country) {
          query = query.eq("country", filter.country);
        } else if (filter.type === "usernames" && filter.usernames) {
          const usernameList = filter.usernames.split(",").map((u: string) => u.trim());
          query = query.in("username", usernameList);
        }

        const { data: recipients, error: recipientsError } = await query;

        if (recipientsError) {
          throw recipientsError;
        }

        if (!recipients || recipients.length === 0) {
          console.log(`[SCHEDULED-EMAILS] No recipients found for email ID: ${scheduledEmail.id}`);
          
          // Mark as failed
          await supabase
            .from("scheduled_emails")
            .update({ 
              status: "failed",
              sent_at: new Date().toISOString() 
            })
            .eq("id", scheduledEmail.id);

          failedCount++;
          continue;
        }

        console.log(`[SCHEDULED-EMAILS] Sending to ${recipients.length} recipients`);

        // Send emails to all recipients
        let sentCount = 0;
        let emailFailedCount = 0;

        for (const recipient of recipients) {
          try {
            // Personalize content
            let personalizedBody = scheduledEmail.body;
            let personalizedSubject = scheduledEmail.subject;

            const replacements: Record<string, string> = {
              'username': recipient.username || 'User',
              'email': recipient.email || '',
              'full_name': recipient.full_name || recipient.username || 'User',
            };

            Object.entries(replacements).forEach(([key, value]) => {
              const regex = new RegExp(`{{${key}}}`, 'g');
              personalizedBody = personalizedBody.replace(regex, value);
              personalizedSubject = personalizedSubject.replace(regex, value);
            });

            // Send email
            const emailResponse = await resend.emails.send({
              from: "FineEarn <onboarding@resend.dev>",
              to: [recipient.email!],
              subject: personalizedSubject,
              html: personalizedBody,
              reply_to: "support@fineearn.com",
            });

            // Log successful send
            await supabase.from("email_logs").insert([
              {
                recipient_email: recipient.email,
                recipient_user_id: recipient.id,
                subject: personalizedSubject,
                body: personalizedBody,
                status: "sent",
                sent_at: new Date().toISOString(),
                sent_by: scheduledEmail.created_by,
                metadata: { 
                  resend_id: emailResponse.data?.id,
                  scheduled_email_id: scheduledEmail.id,
                  variables_used: Object.keys(replacements)
                },
              },
            ]);

            sentCount++;
          } catch (emailError: any) {
            console.error(`[SCHEDULED-EMAILS] Failed to send to ${recipient.email}:`, emailError);

            // Log failed send
            await supabase.from("email_logs").insert([
              {
                recipient_email: recipient.email,
                recipient_user_id: recipient.id,
                subject: scheduledEmail.subject,
                body: scheduledEmail.body,
                status: "failed",
                error_message: emailError.message,
                sent_by: scheduledEmail.created_by,
                metadata: { 
                  scheduled_email_id: scheduledEmail.id 
                },
              },
            ]);

            emailFailedCount++;
          }
        }

        // Update scheduled email status
        const finalStatus = sentCount > 0 ? "sent" : "failed";
        await supabase
          .from("scheduled_emails")
          .update({ 
            status: finalStatus,
            sent_at: new Date().toISOString() 
          })
          .eq("id", scheduledEmail.id);

        console.log(`[SCHEDULED-EMAILS] Email ID ${scheduledEmail.id} processed: ${sentCount} sent, ${emailFailedCount} failed`);
        processedCount++;

      } catch (error: any) {
        console.error(`[SCHEDULED-EMAILS] Error processing email ID ${scheduledEmail.id}:`, error);

        // Mark as failed
        await supabase
          .from("scheduled_emails")
          .update({ 
            status: "failed",
            sent_at: new Date().toISOString() 
          })
          .eq("id", scheduledEmail.id);

        failedCount++;
      }
    }

    console.log(`[SCHEDULED-EMAILS] Processing complete: ${processedCount} succeeded, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processedCount + failedCount} scheduled emails`,
        processed: processedCount,
        failed: failedCount,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("[SCHEDULED-EMAILS] Fatal error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: "Failed to process scheduled emails"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
