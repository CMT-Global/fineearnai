import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { corsHeaders } from "../_shared/cors.ts";
import { sendTemplateEmail } from "../_shared/email-sender.ts";

interface UserTransfersConfig {
  enabled?: boolean;
  min_amount?: number;
  max_amount?: number;
}

const OTP_EXPIRY_MINUTES = 10;
const RATE_LIMIT_WINDOW_MINUTES = 15;
const MAX_OTPS_PER_WINDOW = 5;
const MAX_ATTEMPTS = 3;

function generateReferenceId(): string {
  const part = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `TRF-${part}`;
}

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
    const { recipient_id, amount, note } = body as { recipient_id: string; amount: number; note?: string };
    if (!recipient_id || amount == null || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "recipient_id and a positive amount are required" }),
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

    const minAmount = config.min_amount ?? 1;
    const maxAmount = config.max_amount ?? 100000;
    if (amount < minAmount) {
      return new Response(
        JSON.stringify({ error: `Minimum transfer amount is ${minAmount}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (amount > maxAmount) {
      return new Response(
        JSON.stringify({ error: `Maximum transfer amount is ${maxAmount}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (recipient_id === user.id) {
      return new Response(
        JSON.stringify({ error: "You cannot transfer to yourself." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: senderProfile, error: senderError } = await supabase
      .from("profiles")
      .select("deposit_wallet_balance, email, username")
      .eq("id", user.id)
      .single();
    if (senderError || !senderProfile) {
      return new Response(JSON.stringify({ error: "Sender profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const balance = Number(senderProfile.deposit_wallet_balance ?? 0);
    if (balance < amount) {
      return new Response(
        JSON.stringify({ error: "Insufficient deposit wallet balance." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: recipientProfile } = await supabase
      .from("profiles")
      .select("id, full_name, username")
      .eq("id", recipient_id)
      .maybeSingle();
    if (!recipientProfile) {
      return new Response(JSON.stringify({ error: "Recipient not found." }), {
        status: 404,
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

    const referenceId = generateReferenceId();
    const { data: transferRow, error: insertTransferError } = await supabase
      .from("user_transfers")
      .insert({
        reference_id: referenceId,
        sender_id: user.id,
        recipient_id,
        amount,
        currency: "USD",
        status: "pending",
        otp_requested_at: new Date().toISOString(),
        metadata: { note: note ?? null, audit: [{ event: "otp_requested", at: new Date().toISOString() }] },
      })
      .select("id")
      .single();
    if (insertTransferError) {
      console.error("[send-user-transfer-otp] insert user_transfers", insertTransferError);
      return new Response(JSON.stringify({ error: "Failed to create transfer" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
    const { error: otpInsertError } = await supabase.from("user_transfer_otps").insert({
      user_id: user.id,
      user_transfer_id: transferRow.id,
      otp_code: otpCode,
      expires_at: expiresAt,
      attempts: 0,
      max_attempts: MAX_ATTEMPTS,
    });
    if (otpInsertError) {
      console.error("[send-user-transfer-otp] insert OTP", otpInsertError);
      await supabase.from("user_transfers").update({ status: "failed", failure_reason: "OTP creation failed", updated_at: new Date().toISOString() }).eq("id", transferRow.id);
      return new Response(JSON.stringify({ error: "Failed to create OTP" }), {
        status: 500,
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

    try {
      await sendTemplateEmail({
        templateType: "user_transfer_otp",
        recipientEmail: senderEmail,
        recipientUserId: user.id,
        variables: {
          username: senderProfile.username || "User",
          otp_code: otpCode,
          expires_in_minutes: String(OTP_EXPIRY_MINUTES),
          reference_id: referenceId,
        },
        supabaseClient: supabase,
      });
    } catch (emailErr) {
      console.error("[send-user-transfer-otp] email", emailErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_transfer_id: transferRow.id,
        reference_id: referenceId,
        expires_in_seconds: OTP_EXPIRY_MINUTES * 60,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-user-transfer-otp]", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
