import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { wrapInProfessionalTemplate } from "../_shared/email-template-wrapper.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BulkEmailRequest {
  subject: string;
  body: string;
  recipientType: string;
  plan?: string;
  country?: string;
  usernames?: string;
  email?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT with improved error handling
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[BULK EMAIL] Missing authorization header");
      return new Response(
        JSON.stringify({ 
          error: "Authentication required",
          message: "Please log in again to send emails"
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    let user;
    
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        console.error("[BULK EMAIL] Auth error:", authError.message);
        return new Response(
          JSON.stringify({ 
            error: "Authentication failed",
            message: "Your session has expired. Please log in again.",
            details: authError.message
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
      
      if (!authUser) {
        console.error("[BULK EMAIL] No user found in token");
        return new Response(
          JSON.stringify({ 
            error: "User not found",
            message: "Please log in again to continue"
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
      
      user = authUser;
    } catch (error: any) {
      console.error("[BULK EMAIL] Exception during auth:", error);
      return new Response(
        JSON.stringify({ 
          error: "Authentication error",
          message: "Failed to verify your session. Please log in again.",
          details: error.message
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Verify admin role
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) {
      console.error("[BULK EMAIL] Role check error:", roleError);
      return new Response(
        JSON.stringify({ 
          error: "Permission check failed",
          message: "Unable to verify admin permissions"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    if (!roleData) {
      console.error("[BULK EMAIL] User not admin:", user.id);
      return new Response(
        JSON.stringify({ 
          error: "Access denied",
          message: "Admin privileges required to send bulk emails"
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { subject, body, recipientType, plan, country, usernames, email }: BulkEmailRequest =
      await req.json();

    // Generate unique batch ID for this bulk send operation
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    console.log("Sending bulk email:", { subject, recipientType, plan, country, email, batchId });

    // Handle email recipient type (single external email)
    if (recipientType === "email" && email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return new Response(
          JSON.stringify({ 
            error: "Invalid email address",
            message: "Please provide a valid email address"
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // For email type, create a single recipient object
      const recipients = [{
        email: email.trim(),
        username: 'External User',
        id: null,
        full_name: 'External User'
      }];

      console.log(`Sending to external email: ${email.trim()}`);

      // PHASE 4 CRITICAL FIX: Fetch dynamic email settings ONCE before loop
      console.log(`⚙️  [Bulk Email] Fetching dynamic email settings...`);
      const { data: configData } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'email_settings')
        .maybeSingle();

      const emailSettings = configData?.value || {
        from_address: 'noreply@mail.fineearn.com',
        from_name: 'FineEarn',
        reply_to_address: 'support@fineearn.com',
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
          to: [email.trim()],
          subject: subject,
          html: wrappedBody,
          text: textVersion,
          reply_to: emailSettings.reply_to_address,
          headers: {
            'X-Entity-Ref-ID': `external-${Date.now()}`,
          },
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
            },
          },
        ]);

        return new Response(
          JSON.stringify({
            success: true,
            message: `Email sent successfully to ${email.trim()}`,
            total: 1,
            successful: 1,
            failed: 0,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      } catch (error: any) {
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
            },
          },
        ]);

        return new Response(
          JSON.stringify({ 
            error: error.message,
            message: "Failed to send email"
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    // Get recipients based on criteria (for database users)
    let query = supabase.from("profiles").select("email, username, id, full_name");

    if (recipientType === "plan" && plan) {
      query = query.eq("membership_plan", plan);
    } else if (recipientType === "country" && country) {
      query = query.eq("country", country);
    } else if (recipientType === "usernames" && usernames) {
      const usernameList = usernames.split(",").map((u) => u.trim());
      query = query.in("username", usernameList);
    }

    const { data: recipients, error: recipientsError } = await query;

    if (recipientsError) {
      throw recipientsError;
    }

    if (!recipients || recipients.length === 0) {
      throw new Error("No recipients found");
    }

    console.log(`Found ${recipients.length} recipients`);

    // PHASE 4 CRITICAL FIX: Fetch dynamic email settings ONCE before loop
    console.log(`⚙️  [Bulk Email] Fetching dynamic email settings...`);
    const { data: configData } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'email_settings')
      .maybeSingle();

    const emailSettings = configData?.value || {
      from_address: 'noreply@mail.fineearn.com',
      from_name: 'FineEarn',
      reply_to_address: 'support@fineearn.com',
    };

    console.log(`✅ [Bulk Email] Using settings - From: ${emailSettings.from_name} <${emailSettings.from_address}>`);
    console.log(`✅ [Bulk Email] Reply-To: ${emailSettings.reply_to_address}`);
    console.log(`🔧 [Bulk Email] CRITICAL FIX: Replaced onboarding@resend.dev with verified domain`);

    // Send emails to all recipients
    const emailPromises = recipients.map(async (recipient) => {
    try {
      // Replace variables in body
      let personalizedBody = body;
      let personalizedSubject = subject;
      
      // Replace all common variables
      const replacements: Record<string, string> = {
        'username': recipient.username || 'User',
        'email': recipient.email || '',
        'full_name': recipient.full_name || recipient.username || 'User',
      };
      
      // Perform replacements
      Object.entries(replacements).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        personalizedBody = personalizedBody.replace(regex, value);
        personalizedSubject = personalizedSubject.replace(regex, value);
      });

      // Wrap personalized content in professional template
      const wrappedBody = wrapInProfessionalTemplate(personalizedBody, {
        title: 'FineEarn',
        preheader: personalizedSubject,
        headerGradient: true,
        includeFooter: true
      });

      // Create plain text version by stripping HTML tags
      const textVersion = personalizedBody.replace(/<[^>]*>/g, '').trim();

      const emailResponse = await resend.emails.send({
        from: `${emailSettings.from_name} <${emailSettings.from_address}>`,
        to: [recipient.email!],
        subject: personalizedSubject,
        html: wrappedBody,
        text: textVersion,
        reply_to: emailSettings.reply_to_address,
        headers: {
          'X-Entity-Ref-ID': `${recipient.id}-${Date.now()}`,
          'List-Unsubscribe': `<mailto:${emailSettings.reply_to_address}?subject=Unsubscribe>`,
        },
      });

      // Log the email with email_type metadata for filtering
      await supabase.from("email_logs").insert([
        {
          recipient_email: recipient.email,
          recipient_user_id: recipient.id,
          subject: personalizedSubject,
          body: wrappedBody,
          status: "sent",
          sent_at: new Date().toISOString(),
          sent_by: user.id,
          metadata: { 
            resend_id: emailResponse.data?.id,
            variables_used: Object.keys(replacements),
            email_type: 'bulk',
            batch_id: batchId,
            wrapped_in_template: true,
            original_body: personalizedBody
          },
        },
      ]);

        return { success: true, email: recipient.email };
      } catch (error: any) {
        console.error(`Failed to send email to ${recipient.email}:`, error);

        // Log the failure
        await supabase.from("email_logs").insert([
          {
            recipient_email: recipient.email,
            recipient_user_id: recipient.id,
            subject: subject,
            body: body,
            status: "failed",
            error_message: error.message,
            sent_by: user.id,
            metadata: {
              email_type: 'bulk',
              batch_id: batchId
            },
          },
        ]);

        return { success: false, email: recipient.email, error: error.message };
      }
    });

    const results = await Promise.all(emailPromises);

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`Email sending complete: ${successful} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${successful} emails successfully, ${failed} failed`,
        total: recipients.length,
        successful,
        failed,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-bulk-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
