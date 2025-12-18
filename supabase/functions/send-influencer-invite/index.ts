import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getSystemSecrets } from "../_shared/secrets.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InfluencerInviteRequest {
  email: string;
  influencerName: string;
  commissionRate?: string;
  customMessage?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const secrets = await getSystemSecrets(supabase);
    const resend = new Resend(secrets.resendApiKey);

    // Verify admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[INFLUENCER INVITE] Missing authorization header");
      return new Response(
        JSON.stringify({ 
          error: "Authentication required",
          message: "Please log in again"
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
      
      if (authError || !authUser) {
        console.error("[INFLUENCER INVITE] Auth error:", authError?.message);
        return new Response(
          JSON.stringify({ 
            error: "Authentication failed",
            message: "Your session has expired. Please log in again."
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
      
      user = authUser;
    } catch (error: any) {
      console.error("[INFLUENCER INVITE] Exception during auth:", error);
      return new Response(
        JSON.stringify({ 
          error: "Authentication error",
          message: "Failed to verify your session"
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

    if (roleError || !roleData) {
      console.error("[INFLUENCER INVITE] User not admin:", user.id);
      return new Response(
        JSON.stringify({ 
          error: "Access denied",
          message: "Admin privileges required"
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { email, influencerName, commissionRate, customMessage }: InfluencerInviteRequest = await req.json();

    if (!email || !influencerName) {
      return new Response(
        JSON.stringify({ error: "Email and influencer name are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("[INFLUENCER INVITE] Sending to:", email, "Name:", influencerName);

    // Fetch email template
    const { data: template, error: templateError } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_type", "influencer_invite")
      .eq("is_active", true)
      .maybeSingle();

    if (templateError || !template) {
      console.error("[INFLUENCER INVITE] Template error:", templateError);
      return new Response(
        JSON.stringify({ 
          error: "Email template not found",
          message: "The influencer invite template is not configured"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Fetch dynamic email settings
    console.log("[INFLUENCER INVITE] Fetching email settings...");
    const { data: configData } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'email_settings')
      .maybeSingle();

    const emailSettings = configData?.value || {
      from_address: 'noreply@profitchips.com',
      from_name: 'ProfitChips',
      reply_to_address: 'support@profitchips.com',
    };

    console.log("[INFLUENCER INVITE] Using email settings:", emailSettings);

    // Generate referral link (you can customize this based on your needs)
    const referralLink = `${supabaseUrl.replace('//', '//app.')}/signup?ref=influencer`;
    
    // Replace variables in subject and body
    const variables = {
      influencer_name: influencerName,
      commission_rate: commissionRate || "15",
      referral_link: referralLink,
      support_email: emailSettings.reply_to_address,
    };

    let personalizedSubject = template.subject;
    let personalizedBody = template.body;

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      personalizedSubject = personalizedSubject.replace(regex, value);
      personalizedBody = personalizedBody.replace(regex, value);
    });

    // Add custom message if provided
    if (customMessage) {
      personalizedBody = `<div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #ffc107;">
        <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #856404;">
          <strong>Personal Message:</strong><br/>${customMessage}
        </p>
      </div>` + personalizedBody;
    }

    // Send email via Resend
    console.log("[INFLUENCER INVITE] Sending email via Resend...");
    const emailResponse = await resend.emails.send({
      from: `${emailSettings.from_name} <${emailSettings.from_address}>`,
      to: [email],
      subject: personalizedSubject,
      html: personalizedBody,
      reply_to: emailSettings.reply_to_address,
      headers: {
        'X-Entity-Ref-ID': `influencer-${Date.now()}`,
        'List-Unsubscribe': `<mailto:${emailSettings.reply_to_address}?subject=Unsubscribe>`,
      },
    });

    if (!emailResponse.data?.id) {
      throw new Error("Failed to send email via Resend");
    }

    console.log("[INFLUENCER INVITE] Email sent successfully:", emailResponse.data.id);

    // Log the email
    await supabase.from("email_logs").insert([
      {
        recipient_email: email,
        subject: personalizedSubject,
        body: personalizedBody,
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_by: user.id,
        metadata: { 
          resend_id: emailResponse.data.id,
          email_type: 'influencer_invite',
          template_id: template.id,
          variables: variables,
          custom_message_included: !!customMessage,
        },
      },
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Influencer invite sent successfully",
        resend_id: emailResponse.data.id,
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
    console.error("[INFLUENCER INVITE] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        message: "Failed to send influencer invite"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);