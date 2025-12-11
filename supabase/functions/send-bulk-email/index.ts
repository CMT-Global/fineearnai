import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { wrapInProfessionalTemplate } from "../_shared/email-template-wrapper.ts";
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const handler = async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Get user from JWT with improved error handling
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[BULK EMAIL] Missing authorization header");
      return new Response(JSON.stringify({
        error: "Authentication required",
        message: "Please log in again to send emails"
      }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    const token = authHeader.replace("Bearer ", "");
    let user;
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      if (authError) {
        console.error("[BULK EMAIL] Auth error:", authError.message);
        return new Response(JSON.stringify({
          error: "Authentication failed",
          message: "Your session has expired. Please log in again.",
          details: authError.message
        }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
      if (!authUser) {
        console.error("[BULK EMAIL] No user found in token");
        return new Response(JSON.stringify({
          error: "User not found",
          message: "Please log in again to continue"
        }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
      user = authUser;
    } catch (error) {
      console.error("[BULK EMAIL] Exception during auth:", error);
      return new Response(JSON.stringify({
        error: "Authentication error",
        message: "Failed to verify your session. Please log in again.",
        details: error.message
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    // Verify admin role
    const { data: roleData, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (roleError) {
      console.error("[BULK EMAIL] Role check error:", roleError);
      return new Response(JSON.stringify({
        error: "Permission check failed",
        message: "Unable to verify admin permissions"
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    if (!roleData) {
      console.error("[BULK EMAIL] User not admin:", user.id);
      return new Response(JSON.stringify({
        error: "Access denied",
        message: "Admin privileges required to send bulk emails"
      }), {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    const { subject, body, recipientType, plan, country, usernames, email } = await req.json();
    // Generate unique batch ID for this bulk send operation
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    console.log("Sending bulk email:", {
      subject,
      recipientType,
      plan,
      country,
      email,
      batchId
    });
    // Handle email recipient type (single external email)
    if (recipientType === "email" && email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return new Response(JSON.stringify({
          error: "Invalid email address",
          message: "Please provide a valid email address"
        }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
      // For email type, create a single recipient object
      const recipients = [
        {
          email: email.trim(),
          username: 'External User',
          id: null,
          full_name: 'External User'
        }
      ];
      console.log(`Sending to external email: ${email.trim()}`);
      // PHASE 4 CRITICAL FIX: Fetch dynamic email settings ONCE before loop
      console.log(`⚙️  [Bulk Email] Fetching dynamic email settings...`);
      const { data: configData } = await supabase.from('platform_config').select('value').eq('key', 'email_settings').maybeSingle();
      const emailSettings = configData?.value || {
        from_address: 'noreply@mail.fineearn.com',
        from_name: 'FineEarn',
        reply_to_address: 'support@fineearn.com'
      };
      console.log(`✅ [Bulk Email] Using settings - From: ${emailSettings.from_name} <${emailSettings.from_address}>`);
      // Send email to external address
      try {
        // Wrap content in professional template
        const wrappedBody = wrapInProfessionalTemplate(body, {
          title: 'FineEarn',
          preheader: subject,
          headerGradient: true,
          includeFooter: true
        });
        // Create plain text version by stripping HTML tags
        const textVersion = body.replace(/<[^>]*>/g, '').trim();
        const emailResponse = await resend.emails.send({
          from: `${emailSettings.from_name} <${emailSettings.from_address}>`,
          to: [
            email.trim()
          ],
          subject: subject,
          html: wrappedBody,
          text: textVersion,
          reply_to: emailSettings.reply_to_address,
          headers: {
            'X-Entity-Ref-ID': `external-${Date.now()}`
          }
        });
        // Log the email
        await supabase.from("email_logs").insert([
          {
            recipient_email: email.trim(),
            recipient_user_id: null,
            subject: subject,
            body: wrappedBody,
            status: "sent",
            sent_at: new Date().toISOString(),
            sent_by: user.id,
            metadata: {
              resend_id: emailResponse.data?.id,
              email_type: 'bulk',
              batch_id: batchId,
              external_email: true,
              wrapped_in_template: true,
              original_body: body
            }
          }
        ]);
        return new Response(JSON.stringify({
          success: true,
          message: `Email sent successfully to ${email.trim()}`,
          total: 1,
          successful: 1,
          failed: 0
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      } catch (error) {
        console.error(`Failed to send email to ${email.trim()}:`, error);
        // Log the failure
        await supabase.from("email_logs").insert([
          {
            recipient_email: email.trim(),
            recipient_user_id: null,
            subject: subject,
            body: body,
            status: "failed",
            error_message: error.message,
            sent_by: user.id,
            metadata: {
              email_type: 'bulk',
              batch_id: batchId,
              external_email: true
            }
          }
        ]);
        return new Response(JSON.stringify({
          error: error.message,
          message: "Failed to send email"
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
    }
    // PHASE 2: BUILD COUNT QUERY (for database users only)
    let countQuery = supabase.from("profiles").select("*", {
      count: 'exact',
      head: true
    });
    // Store recipient filter for job processing
    const recipientFilter = {
      type: recipientType
    };
    if (recipientType === "plan" && plan) {
      countQuery = countQuery.eq("membership_plan", plan);
      recipientFilter.plan = plan;
    } else if (recipientType === "country" && country) {
      countQuery = countQuery.eq("country", country);
      recipientFilter.country = country;
    } else if (recipientType === "usernames" && usernames) {
      const usernameList = usernames.split(",").map((u)=>u.trim());
      countQuery = countQuery.in("username", usernameList);
      recipientFilter.usernames = usernameList;
    } else if (recipientType === "all") {
      recipientFilter.all = true;
    }
    console.log(`[BULK EMAIL QUEUE] Counting recipients for:`, recipientFilter);
    // PHASE 2: GET COUNT ONLY (no data fetch)
    const { count: totalRecipients, error: countError } = await countQuery;
    if (countError) {
      console.error("[BULK EMAIL QUEUE] Count error:", countError);
      throw countError;
    }
    if (!totalRecipients || totalRecipients === 0) {
      return new Response(JSON.stringify({
        error: "No recipients found",
        message: "No users match the selected criteria"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    console.log(`[BULK EMAIL QUEUE] Found ${totalRecipients} recipients`);
    // PHASE 2: CALCULATE ESTIMATED TIME
    // Throughput: 200 emails/second = 12,000 emails/minute
    const estimatedMinutes = Math.ceil(totalRecipients / 12000);
    console.log(`[BULK EMAIL QUEUE] Estimated completion time: ${estimatedMinutes} minutes`);
    // PHASE 2: CREATE JOB RECORD
    const { data: jobData, error: jobError } = await supabase.from("bulk_email_jobs").insert({
      batch_id: batchId,
      subject: subject,
      body: body,
      recipient_filter: recipientFilter,
      total_recipients: totalRecipients,
      status: 'queued',
      created_by: user.id
    }).select().single();
    if (jobError) {
      console.error("[BULK EMAIL QUEUE] Job creation error:", jobError);
      throw new Error(`Failed to create email job: ${jobError.message}`);
    }
    console.log(`[BULK EMAIL QUEUE] ✅ Job created successfully: ${jobData.id}`);
    console.log(`[BULK EMAIL QUEUE] 🎯 Total recipients: ${totalRecipients}`);
    console.log(`[BULK EMAIL QUEUE] ⏱️  Estimated time: ${estimatedMinutes} minutes`);
    console.log(`[BULK EMAIL QUEUE] 📊 Status: queued`);
    // PHASE 2: RETURN IMMEDIATE SUCCESS RESPONSE
    return new Response(JSON.stringify({
      success: true,
      message: `Bulk email job created successfully. Processing ${totalRecipients} recipients in background.`,
      job_id: jobData.id,
      batch_id: batchId,
      total_recipients: totalRecipients,
      estimated_time_minutes: estimatedMinutes,
      status: 'queued'
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error("Error in send-bulk-email function:", error);
    return new Response(JSON.stringify({
      error: error.message
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
