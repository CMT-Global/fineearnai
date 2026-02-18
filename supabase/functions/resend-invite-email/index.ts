import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const token = authHeader.replace("Bearer ", "");
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { data: roleRow } = await supabaseAnon
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: { invite_request_id?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const inviteRequestId = typeof body.invite_request_id === "string" ? body.invite_request_id.trim() : "";
    if (!inviteRequestId) {
      return new Response(
        JSON.stringify({ error: "invite_request_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: inviteRequest, error: fetchErr } = await supabase
      .from("invite_requests")
      .select("id, full_name, email, country, status, assigned_referral_code")
      .eq("id", inviteRequestId)
      .single();

    if (fetchErr || !inviteRequest) {
      return new Response(
        JSON.stringify({ error: "Invite request not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (inviteRequest.status !== "verified" && inviteRequest.status !== "invite_sent") {
      return new Response(
        JSON.stringify({ error: "Invite email can only be resent for verified or already-sent requests" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let inviteLink: string;
    let assignedReferralCode = inviteRequest.assigned_referral_code;
    if (!assignedReferralCode) {
      const { data: configRow } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "invite_only_registration_config")
        .single();
      const config = (configRow?.value as Record<string, unknown>) || {};
      const defaultUsername = (config.default_invite_referrer_username as string)?.trim() || "";
      if (defaultUsername) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, referral_code")
          .eq("username", defaultUsername)
          .maybeSingle();
        if (profile?.referral_code) {
          assignedReferralCode = profile.referral_code;
          await supabase
            .from("invite_requests")
            .update({ assigned_referrer_id: profile.id, assigned_referral_code: profile.referral_code, updated_at: new Date().toISOString() })
            .eq("id", inviteRequestId);
        }
      }
      if (!assignedReferralCode) {
        const { data: fallback } = await supabase
          .from("profiles")
          .select("id, referral_code")
          .not("referral_code", "is", null)
          .limit(1)
          .maybeSingle();
        if (fallback?.referral_code) {
          assignedReferralCode = fallback.referral_code;
          await supabase
            .from("invite_requests")
            .update({ assigned_referrer_id: fallback.id, assigned_referral_code: fallback.referral_code, updated_at: new Date().toISOString() })
            .eq("id", inviteRequestId);
        }
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

    inviteLink = assignedReferralCode
      ? `${platformUrl.replace(/\/$/, "")}/signup?ref=${encodeURIComponent(assignedReferralCode)}`
      : `${platformUrl.replace(/\/$/, "")}/signup`;

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
      console.error(`[${requestId}] send invite_link:`, sendErr);
      return new Response(
        JSON.stringify({ error: "Failed to send email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();
    await supabase
      .from("invite_requests")
      .update({ status: "invite_sent", invite_sent_at: now, updated_at: now })
      .eq("id", inviteRequestId);

    await supabase.from("invite_request_events").insert({
      invite_request_id: inviteRequestId,
      event_type: "invite_email_sent",
      meta: { resend: true },
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(`[${requestId}] resend-invite-email error:`, err);
    return new Response(
      JSON.stringify({ error: "Something went wrong" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
