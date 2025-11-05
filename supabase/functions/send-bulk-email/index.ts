import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

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
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Verify admin role
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      throw new Error("Unauthorized: Admin access required");
    }

    const { subject, body, recipientType, plan, country, usernames }: BulkEmailRequest =
      await req.json();

    console.log("Sending bulk email:", { subject, recipientType, plan, country });

    // Get recipients based on criteria
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

      const emailResponse = await resend.emails.send({
        from: `${emailSettings.from_name} <${emailSettings.from_address}>`,
        to: [recipient.email!],
        subject: personalizedSubject,
        html: personalizedBody,
        reply_to: emailSettings.reply_to_address,
      });

      // Log the email
      await supabase.from("email_logs").insert([
        {
          recipient_email: recipient.email,
          recipient_user_id: recipient.id,
          subject: personalizedSubject,
          body: personalizedBody,
          status: "sent",
          sent_at: new Date().toISOString(),
          sent_by: user.id,
          metadata: { 
            resend_id: emailResponse.data?.id,
            variables_used: Object.keys(replacements)
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
