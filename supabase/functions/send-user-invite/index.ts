import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@4.0.0";
import { corsHeaders } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface UserInviteRequest {
  email: string;
  inviteeName: string;
  signupBonus?: string;
  customMessage?: string;
}

interface EmailSettings {
  from_name: string;
  from_address: string;
  reply_to_address: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[USER-INVITE] Missing Authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("[USER-INVITE] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("admin_role")
      .eq("id", user.id)
      .single();

    if (!profile?.admin_role) {
      console.error("[USER-INVITE] User is not admin:", user.id);
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestData: UserInviteRequest = await req.json();
    const { email, inviteeName, signupBonus, customMessage } = requestData;

    console.log("[USER-INVITE] Processing invite for:", email);

    // Validate required fields
    if (!email || !inviteeName) {
      return new Response(
        JSON.stringify({ error: "Email and invitee name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user invite template
    const { data: template, error: templateError } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_type", "user_invite")
      .eq("is_active", true)
      .single();

    if (templateError || !template) {
      console.error("[USER-INVITE] Template fetch error:", templateError);
      return new Response(
        JSON.stringify({ error: "User invite template not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch email settings
    const { data: emailConfig } = await supabase
      .from("platform_config")
      .select("value")
      .eq("key", "email_settings")
      .single();

    const emailSettings: EmailSettings = emailConfig?.value || {
      from_name: "FineEarn",
      from_address: "onboarding@resend.dev",
      reply_to_address: "support@fineearn.com",
    };

    // Get platform URL
    const platformUrl = Deno.env.get("VITE_SUPABASE_URL")?.replace("/auth/v1", "") || "https://fineearn.com";
    const bonusText = signupBonus || "Get started with your first tasks!";

    // Replace variables in template
    let personalizedSubject = template.subject
      .replace(/{{invitee_name}}/g, inviteeName);

    let personalizedBody = template.body
      .replace(/{{invitee_name}}/g, inviteeName)
      .replace(/{{platform_url}}/g, platformUrl)
      .replace(/{{signup_bonus}}/g, bonusText)
      .replace(/{{support_email}}/g, emailSettings.reply_to_address);

    // Add custom message if provided
    if (customMessage && customMessage.trim()) {
      const customMessageHtml = `
        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #856404;"><strong>Personal Message:</strong></p>
          <p style="margin: 10px 0 0 0; color: #856404;">${customMessage}</p>
        </div>
      `;
      personalizedBody = personalizedBody.replace('</body>', `${customMessageHtml}</body>`);
    }

    // Generate unique tracking ID
    const trackingId = `user-invite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: `${emailSettings.from_name} <${emailSettings.from_address}>`,
      to: [email],
      subject: personalizedSubject,
      html: personalizedBody,
      reply_to: emailSettings.reply_to_address,
      headers: {
        'X-Entity-Ref-ID': trackingId,
        'List-Unsubscribe': `<mailto:${emailSettings.reply_to_address}>`,
      },
    });

    console.log("[USER-INVITE] Resend response:", emailResponse);

    if (emailResponse.error) {
      throw new Error(`Resend error: ${emailResponse.error.message}`);
    }

    // Log email to database
    const { error: logError } = await supabase.from("email_logs").insert({
      recipient_email: email,
      subject: personalizedSubject,
      body: personalizedBody,
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_by: user.id,
      template_id: template.id,
      metadata: {
        resend_id: emailResponse.data?.id,
        tracking_id: trackingId,
        email_type: "user_invite",
        invitee_name: inviteeName,
        signup_bonus: bonusText,
        custom_message: customMessage || null,
        sent_at: new Date().toISOString(),
      },
    });

    if (logError) {
      console.error("[USER-INVITE] Error logging email:", logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "User invite sent successfully",
        resend_id: emailResponse.data?.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[USER-INVITE] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send user invite" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
