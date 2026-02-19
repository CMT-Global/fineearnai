import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const MAX_OTP_ATTEMPTS = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let body: { invite_request_id?: string; otp_code?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const inviteRequestId = typeof body.invite_request_id === "string" ? body.invite_request_id.trim() : "";
    const otpCode = typeof body.otp_code === "string" ? body.otp_code.replace(/\s/g, "") : "";
    if (!inviteRequestId || !otpCode || !/^\d{6}$/.test(otpCode)) {
      return new Response(
        JSON.stringify({ error: "Invalid invite request or verification code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: inviteRequest, error: reqError } = await supabase
      .from("invite_requests")
      .select("id, full_name, email, country, status")
      .eq("id", inviteRequestId)
      .single();

    if (reqError || !inviteRequest) {
      return new Response(
        JSON.stringify({ error: "Invite request not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (inviteRequest.status !== "pending_email_verification") {
      return new Response(
        JSON.stringify({ error: "This request was already verified or the invite was already sent." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: otpRows } = await supabase
      .from("invite_request_otps")
      .select("id, otp_code, expires_at, attempts, used_at")
      .eq("invite_request_id", inviteRequestId)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    const otpRow = otpRows?.[0];
    if (!otpRow) {
      await supabase.from("invite_request_events").insert({
        invite_request_id: inviteRequestId,
        event_type: "otp_failed",
        meta: { reason: "no_valid_otp" },
      });
      return new Response(
        JSON.stringify({ error: "Verification code expired or already used. Please request a new invite." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(otpRow.expires_at) < new Date()) {
      await supabase.from("invite_request_events").insert({
        invite_request_id: inviteRequestId,
        event_type: "otp_failed",
        meta: { reason: "expired" },
      });
      return new Response(
        JSON.stringify({ error: "Verification code has expired. Please submit the request form again to get a new code." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if ((otpRow.attempts ?? 0) >= MAX_OTP_ATTEMPTS) {
      await supabase.from("invite_request_events").insert({
        invite_request_id: inviteRequestId,
        event_type: "otp_failed",
        meta: { reason: "too_many_attempts" },
      });
      return new Response(
        JSON.stringify({ error: "Too many failed attempts. Please submit the request form again to get a new code." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (otpRow.otp_code !== otpCode) {
      await supabase
        .from("invite_request_otps")
        .update({ attempts: (otpRow.attempts ?? 0) + 1 })
        .eq("id", otpRow.id);
      await supabase.from("invite_request_events").insert({
        invite_request_id: inviteRequestId,
        event_type: "otp_failed",
        meta: { reason: "wrong_code" },
      });
      return new Response(
        JSON.stringify({ error: "Invalid verification code. Please try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("invite_request_otps")
      .update({ used_at: new Date().toISOString() })
      .eq("id", otpRow.id);

    const now = new Date().toISOString();
    await supabase
      .from("invite_requests")
      .update({ status: "verified", email_verified_at: now, updated_at: now })
      .eq("id", inviteRequestId);

    await supabase.from("invite_request_events").insert({
      invite_request_id: inviteRequestId,
      event_type: "otp_verified",
      meta: {},
    });

    // Auto-approve: get default referrer
    const { data: configRow } = await supabase
      .from("platform_config")
      .select("value")
      .eq("key", "invite_only_registration_config")
      .single();
    const config = (configRow?.value as Record<string, unknown>) || {};
    const defaultUsername = (config.default_invite_referrer_username as string)?.trim() || "";

    let assignedReferrerId: string | null = null;
    let assignedReferralCode: string | null = null;
    if (defaultUsername) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, referral_code")
        .eq("username", defaultUsername)
        .maybeSingle();
      if (profile) {
        assignedReferrerId = profile.id;
        assignedReferralCode = profile.referral_code ?? null;
      }
    }
    if (!assignedReferralCode) {
      const { data: fallback } = await supabase
        .from("profiles")
        .select("id, referral_code")
        .not("referral_code", "is", null)
        .limit(1)
        .maybeSingle();
      if (fallback) {
        assignedReferrerId = fallback.id;
        assignedReferralCode = fallback.referral_code;
      }
    }

    const { data: emailConfig } = await supabase
      .from("platform_config")
      .select("key, value")
      .in("key", ["email_settings", "platform_branding", "platform_name"]);
    const emailConfigMap: Record<string, unknown> = {};
    emailConfig?.forEach((r: { key: string; value: unknown }) => { emailConfigMap[r.key] = r.value; });
    const emailSettings = (emailConfigMap.email_settings as Record<string, string>) || {};
    const platformBranding = (emailConfigMap.platform_branding as Record<string, string>) || {};
    const platformName = platformBranding?.name ?? emailSettings.platform_name ?? (emailConfigMap.platform_name as string) ?? "ProfitChips";
    const platformUrl = platformBranding?.url ?? emailSettings.platform_url ?? "https://profitchips.com";
    const supportUrl = emailSettings.support_email ?? `${platformUrl}/support`;

    const baseUrl = `${platformUrl.replace(/\/$/, "")}/signup`;
    const params = new URLSearchParams();
    if (assignedReferralCode) params.set("ref", assignedReferralCode);
    params.set("invite_name", inviteRequest.full_name ?? "");
    params.set("invite_email", inviteRequest.email ?? "");
    const inviteLink = `${baseUrl}?${params.toString()}`;

    await supabase
      .from("invite_requests")
      .update({
        assigned_referrer_id: assignedReferrerId,
        assigned_referral_code: assignedReferralCode,
        updated_at: now,
      })
      .eq("id", inviteRequestId);

    const { error: sendErr } = await supabase.functions.invoke("send-template-email", {
      body: {
        email: inviteRequest.email,
        template_type: "invite_link",
        variables: {
          name: inviteRequest.full_name,
          email: inviteRequest.email,
          country: inviteRequest.country ?? "",
          invite_link: inviteLink,
          support_url: supportUrl,
          site_name: platformName,
        },
      },
    });

    if (sendErr) {
      console.error(`[${requestId}] send invite_link email:`, sendErr);
    }

    await supabase
      .from("invite_requests")
      .update({
        status: "invite_sent",
        invite_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", inviteRequestId);

    await supabase.from("invite_request_events").insert({
      invite_request_id: inviteRequestId,
      event_type: "invite_email_sent",
      meta: {},
    });

    return new Response(
      JSON.stringify({ success: true, invite_link: inviteLink }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${requestId}] verify-invite-otp error:`, err);
    return new Response(
      JSON.stringify({
        error: "Verification failed",
        details: message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
