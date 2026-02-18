import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getLocationFromIP, extractClientIP } from "../_shared/ipstack.ts";

const OTP_EXPIRY_MINUTES = 10;
const RATE_LIMIT_PER_IP_DAY = 3;
const RATE_LIMIT_PER_EMAIL_DAY = 3;
const DUPLICATE_INVITE_SENT_DAYS = 7;

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
      console.error(`[${requestId}] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`);
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const clientIP = extractClientIP(req) ?? "unknown";

    let body: { full_name?: string; email?: string; country?: string; country_code?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!fullName || !email || !emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Full name and a valid email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit: per IP (last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: ipCount, error: ipCountError } = await supabase
      .from("invite_requests")
      .select("id", { count: "exact", head: true })
      .eq("request_ip", clientIP)
      .gte("requested_at", oneDayAgo);
    if (ipCountError) {
      console.error(`[${requestId}] invite_requests count (IP) error:`, ipCountError);
      return new Response(
        JSON.stringify({
          error: "Service temporarily unavailable. If this persists, ensure the invite-only migration has been applied.",
          details: ipCountError.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if ((ipCount ?? 0) >= RATE_LIMIT_PER_IP_DAY) {
      return new Response(
        JSON.stringify({ error: "Too many invite requests from this device. Try again tomorrow." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit: per email (last 24h)
    const { count: emailCount } = await supabase
      .from("invite_requests")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("requested_at", oneDayAgo);
    if ((emailCount ?? 0) >= RATE_LIMIT_PER_EMAIL_DAY) {
      return new Response(
        JSON.stringify({ error: "Too many requests for this email. Try again tomorrow." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Duplicate: same email already got invite recently
    const recentSent = new Date(Date.now() - DUPLICATE_INVITE_SENT_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("invite_requests")
      .select("id")
      .eq("email", email)
      .eq("status", "invite_sent")
      .gte("invite_sent_at", recentSent)
      .maybeSingle();
    if (existing) {
      return new Response(
        JSON.stringify({ error: "An invite was already sent to this email recently. Check your inbox or spam." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve country: from body or IPStack (never let geo fail the request)
    let country: string | null = typeof body.country === "string" ? body.country.trim() || null : null;
    let countryCode: string | null = typeof body.country_code === "string" ? body.country_code.trim() || null : null;
    if (!country && clientIP !== "unknown") {
      try {
        const location = await getLocationFromIP(clientIP, supabase);
        if (location) {
          country = location.country_name ?? null;
          countryCode = location.country_code ?? null;
        }
      } catch (geoErr) {
        console.warn(`[${requestId}] getLocationFromIP failed:`, geoErr);
      }
    }

    // Insert invite_requests
    const { data: inviteRequest, error: insertReqError } = await supabase
      .from("invite_requests")
      .insert({
        full_name: fullName,
        email,
        country,
        country_code: countryCode,
        status: "pending_email_verification",
        request_ip: clientIP,
      })
      .select("id")
      .single();

    if (insertReqError || !inviteRequest) {
      console.error(`[${requestId}] invite_requests insert:`, insertReqError);
      const msg = insertReqError?.message ?? "Failed to create invite request";
      return new Response(
        JSON.stringify({
          error: msg.includes("does not exist") ? "Database not ready for invite requests. Please run the invite-only migration." : "Failed to create invite request",
          details: msg,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    const { error: otpInsertError } = await supabase.from("invite_request_otps").insert({
      invite_request_id: inviteRequest.id,
      otp_code: otpCode,
      expires_at: expiresAt,
    });

    if (otpInsertError) {
      console.error(`[${requestId}] invite_request_otps insert:`, otpInsertError);
      return new Response(
        JSON.stringify({
          error: "Failed to create verification code",
          details: otpInsertError.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Email settings for variables
    const { data: configData } = await supabase
      .from("platform_config")
      .select("key, value")
      .in("key", ["email_settings", "platform_name", "platform_branding"]);
    const configMap: Record<string, unknown> = {};
    configData?.forEach((r: { key: string; value: unknown }) => { configMap[r.key] = r.value; });
    const emailSettings = (configMap.email_settings as Record<string, string>) || {};
    const platformBranding = (configMap.platform_branding as Record<string, string>) || {};
    const platformName = platformBranding?.name ?? emailSettings.platform_name ?? (configMap.platform_name as string) ?? "ProfitChips";
    const platformUrl = platformBranding?.url ?? emailSettings.platform_url ?? "https://profitchips.com";
    const supportUrl = emailSettings.support_email ?? `${platformUrl}/support`;

    const { error: invokeError } = await supabase.functions.invoke("send-template-email", {
      body: {
        email,
        template_type: "invite_request_otp",
        variables: {
          name: fullName,
          email,
          country: country ?? "",
          otp_code: otpCode,
          otp_expiry_minutes: String(OTP_EXPIRY_MINUTES),
          support_url: supportUrl,
          site_name: platformName,
        },
      },
    });

    if (invokeError) {
      console.error(`[${requestId}] send-template-email invoke:`, invokeError);
      // Still return success so we don't leak OTP; admin can resend
    }

    // Best-effort event log; do not fail the request if this fails (email already sent)
    const { error: eventErr } = await supabase.from("invite_request_events").insert({
      invite_request_id: inviteRequest.id,
      event_type: "otp_sent",
      meta: {},
    });
    if (eventErr) {
      console.warn(`[${requestId}] invite_request_events insert (non-fatal):`, eventErr);
    }

    return new Response(
      JSON.stringify({ success: true, invite_request_id: inviteRequest.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${requestId}] request-invite error:`, err);
    return new Response(
      JSON.stringify({
        error: "Request failed",
        details: message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
