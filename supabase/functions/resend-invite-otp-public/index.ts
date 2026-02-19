import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const OTP_EXPIRY_MINUTES = 10;
const RESEND_WINDOW_MINUTES = 15;
const MAX_OTP_SENDS_IN_WINDOW = 3;

function generateOTP(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (array[0] % 1000000).toString().padStart(6, "0");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const requestId = crypto.randomUUID().slice(0, 8);
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let body: { invite_request_id?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const inviteRequestId = typeof body.invite_request_id === "string" ? body.invite_request_id.trim() : "";
    if (!inviteRequestId) {
      return new Response(JSON.stringify({ error: "invite_request_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inviteRequest, error: fetchErr } = await supabase
      .from("invite_requests")
      .select("id, full_name, email, country, status")
      .eq("id", inviteRequestId)
      .single();

    if (fetchErr || !inviteRequest) {
      return new Response(JSON.stringify({ error: "Invite request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (inviteRequest.status !== "pending_email_verification") {
      return new Response(
        JSON.stringify({ error: "OTP can only be resent for requests pending verification" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const windowStart = new Date(Date.now() - RESEND_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count, error: countErr } = await supabase
      .from("invite_request_events")
      .select("id", { count: "exact", head: true })
      .eq("invite_request_id", inviteRequestId)
      .eq("event_type", "otp_sent")
      .gte("created_at", windowStart);

    if (countErr || (count ?? 0) >= MAX_OTP_SENDS_IN_WINDOW) {
      return new Response(
        JSON.stringify({ error: "Too many resend attempts. Please try again in a few minutes." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
    await supabase.from("invite_request_otps").insert({
      invite_request_id: inviteRequestId,
      otp_code: otpCode,
      expires_at: expiresAt,
    });

    const { data: configData } = await supabase
      .from("platform_config")
      .select("key, value")
      .in("key", ["email_settings", "platform_branding", "platform_name"]);
    const configMap: Record<string, unknown> = {};
    configData?.forEach((r: { key: string; value: unknown }) => { configMap[r.key] = r.value; });
    const emailSettings = (configMap.email_settings as Record<string, string>) || {};
    const platformBranding = (configMap.platform_branding as Record<string, string>) || {};
    const platformName = platformBranding?.name ?? emailSettings.platform_name ?? "ProfitChips";
    const platformUrl = platformBranding?.url ?? emailSettings.platform_url ?? "https://profitchips.com";
    const supportUrl = emailSettings.support_email ?? platformUrl + "/support";

    await supabase.functions.invoke("send-template-email", {
      body: {
        email: inviteRequest.email,
        template_type: "invite_request_otp",
        variables: {
          name: inviteRequest.full_name,
          email: inviteRequest.email,
          country: inviteRequest.country ?? "",
          otp_code: otpCode,
          otp_expiry_minutes: String(OTP_EXPIRY_MINUTES),
          support_url: supportUrl,
          site_name: platformName,
        },
      },
    });

    await supabase.from("invite_request_events").insert({
      invite_request_id: inviteRequestId,
      event_type: "otp_sent",
      meta: { resend: true },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[" + requestId + "] resend-invite-otp-public error:", err);
    return new Response(JSON.stringify({ error: "Something went wrong" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
