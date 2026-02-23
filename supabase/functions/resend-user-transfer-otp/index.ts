import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { corsHeaders } from "../_shared/cors.ts";
import { sendTemplateEmail } from "../_shared/email-sender.ts";

interface UserTransfersConfig {
  enabled?: boolean;
}

const OTP_EXPIRY_MINUTES = 10;
const RATE_LIMIT_WINDOW_MINUTES = 15;
const MAX_OTPS_PER_WINDOW = 5;
const MAX_ATTEMPTS = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const user_transfer_id = (body as { user_transfer_id?: string }).user_transfer_id?.trim();
    if (!user_transfer_id) {
      return new Response(
        JSON.stringify({ error: "user_transfer_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: configRow } = await supabase
      .from("platform_config")
      .select("value")
      .eq("key", "user_transfers_config")
      .maybeSingle();
    const config = (configRow?.value as UserTransfersConfig) ?? {};
    if (config.enabled === false) {
      return new Response(
        JSON.stringify({
          error: "Transfers are currently unavailable. Please try again later.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: transfer, error: transferError } = await supabase
      .from("user_transfers")
      .select("id, reference_id, sender_id, status")
      .eq("id", user_transfer_id)
      .single();
    if (transferError || !transfer) {
      return new Response(JSON.stringify({ error: "Transfer not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (transfer.status !== "pending") {
      return new Response(
        JSON.stringify({ error: "This transfer is no longer pending. Start a new transfer." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (transfer.sender_id !== user.id) {
      return new Response(JSON.stringify({ error: "Unauthorized for this transfer." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("user_transfer_otps")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", windowStart);
    if ((count ?? 0) >= MAX_OTPS_PER_WINDOW) {
      return new Response(
        JSON.stringify({
          error: `Too many OTP requests. Please try again after ${RATE_LIMIT_WINDOW_MINUTES} minutes.`,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: senderProfile, error: senderError } = await supabase
      .from("profiles")
      .select("email, username")
      .eq("id", user.id)
      .single();
    if (senderError || !senderProfile) {
      return new Response(JSON.stringify({ error: "Sender profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const senderEmail = senderProfile.email || user.email;
    if (!senderEmail) {
      return new Response(JSON.stringify({ error: "Your account has no email for OTP delivery." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
    const { error: otpInsertError } = await supabase.from("user_transfer_otps").insert({
      user_id: user.id,
      user_transfer_id: transfer.id,
      otp_code: otpCode,
      expires_at: expiresAt,
      attempts: 0,
      max_attempts: MAX_ATTEMPTS,
    });
    if (otpInsertError) {
      console.error("[resend-user-transfer-otp] insert OTP", otpInsertError);
      return new Response(JSON.stringify({ error: "Failed to create OTP" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      await sendTemplateEmail({
        templateType: "user_transfer_otp",
        recipientEmail: senderEmail,
        recipientUserId: user.id,
        variables: {
          username: senderProfile.username || "User",
          otp_code: otpCode,
          expires_in_minutes: String(OTP_EXPIRY_MINUTES),
          reference_id: transfer.reference_id,
        },
        supabaseClient: supabase,
      });
    } catch (emailErr) {
      console.error("[resend-user-transfer-otp] email", emailErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        expires_in_seconds: OTP_EXPIRY_MINUTES * 60,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[resend-user-transfer-otp]", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
