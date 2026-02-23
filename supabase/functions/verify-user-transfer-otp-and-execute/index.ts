import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { corsHeaders } from "../_shared/cors.ts";
import { sendTemplateEmail } from "../_shared/email-sender.ts";

const OPTIONS_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

interface UserTransfersConfig {
  enabled?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: OPTIONS_CORS });
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
    const rawTransferId = (body as { user_transfer_id?: string }).user_transfer_id;
    const rawOtp = (body as { otp_code?: string }).otp_code;
    const user_transfer_id = typeof rawTransferId === "string" ? rawTransferId.trim() : "";
    const otp_code = typeof rawOtp === "string"
      ? rawOtp.replace(/\D/g, "").slice(0, 6)
      : "";
    if (!user_transfer_id || !otp_code) {
      return new Response(
        JSON.stringify({ error: "user_transfer_id and otp_code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (otp_code.length !== 6) {
      return new Response(
        JSON.stringify({ error: "Invalid OTP format. Must be 6 digits." }),
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
      .select("id, reference_id, sender_id, recipient_id, amount, status")
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
        JSON.stringify({ error: "This transfer is no longer pending." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (transfer.sender_id !== user.id) {
      return new Response(JSON.stringify({ error: "Unauthorized for this transfer." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const graceSeconds = 60;
    const expiryCutoff = new Date(now.getTime() - graceSeconds * 1000).toISOString();
    const { data: otpRecord, error: otpError } = await supabase
      .from("user_transfer_otps")
      .select("*")
      .eq("user_id", user.id)
      .eq("user_transfer_id", user_transfer_id)
      .is("used_at", null)
      .gt("expires_at", expiryCutoff)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (otpError) {
      console.error("[verify-user-transfer-otp]", otpError);
      return new Response(JSON.stringify({ error: "Failed to verify OTP" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!otpRecord) {
      const { data: latestOtp } = await supabase
        .from("user_transfer_otps")
        .select("used_at, expires_at")
        .eq("user_id", user.id)
        .eq("user_transfer_id", user_transfer_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      let message = "Invalid or expired OTP code.";
      if (latestOtp) {
        if (latestOtp.used_at) message = "This code was already used. Please request a new OTP.";
        else if (latestOtp.expires_at && latestOtp.expires_at <= nowIso) message = "This code has expired. Please request a new OTP.";
      }
      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      await supabase
        .from("user_transfer_otps")
        .update({ used_at: new Date().toISOString() })
        .eq("id", otpRecord.id);
      return new Response(
        JSON.stringify({
          error: "Maximum verification attempts exceeded. Please request a new OTP.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (otpRecord.otp_code !== otp_code) {
      const newAttempts = otpRecord.attempts + 1;
      await supabase
        .from("user_transfer_otps")
        .update({ attempts: newAttempts })
        .eq("id", otpRecord.id);
      const msg =
        newAttempts >= otpRecord.max_attempts
          ? "Maximum verification attempts exceeded. Please request a new OTP."
          : "Invalid OTP code. Try again.";
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("user_transfer_otps")
      .update({ used_at: new Date().toISOString() })
      .eq("id", otpRecord.id);

    const { data: rpcResult, error: rpcError } = await supabase.rpc("process_user_transfer_atomic", {
      p_user_transfer_id: user_transfer_id,
    });
    if (rpcError) {
      console.error("[verify-user-transfer-otp] RPC error", rpcError);
      return new Response(
        JSON.stringify({ error: rpcError.message || "Transfer failed." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const result = rpcResult as { success?: boolean; error?: string; new_sender_balance?: number; reference_id?: string };
    if (!result?.success) {
      return new Response(
        JSON.stringify({ error: result?.error ?? "Transfer failed." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const completedAt = new Date().toISOString();
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("email, full_name, username")
      .eq("id", transfer.sender_id)
      .single();
    const { data: recipientProfile } = await supabase
      .from("profiles")
      .select("email, full_name, username")
      .eq("id", transfer.recipient_id)
      .single();

    const senderName = senderProfile?.full_name || senderProfile?.username || "User";
    const senderUsername = senderProfile?.username || "";
    const recipientName = recipientProfile?.full_name || recipientProfile?.username || "User";
    const recipientUsername = recipientProfile?.username || "";
    const amount = Number(transfer.amount);
    const referenceId = result.reference_id ?? transfer.reference_id;
    const newDepositBalance = result.new_sender_balance;

    try {
      await sendTemplateEmail({
        templateType: "user_transfer_sender_confirmation",
        recipientEmail: senderProfile?.email || user.email,
        recipientUserId: transfer.sender_id,
        variables: {
          sender_name: senderName,
          sender_username: senderUsername,
          recipient_name: recipientName,
          recipient_username: recipientUsername,
          amount,
          currency: "USD",
          reference_id: referenceId,
          created_at: completedAt,
          remaining_deposit_balance: newDepositBalance,
        },
        supabaseClient: supabase,
      });
    } catch (e) {
      console.error("[verify-user-transfer-otp] sender email", e);
    }

    try {
      const recEmail = recipientProfile?.email;
      if (recEmail) {
        await sendTemplateEmail({
          templateType: "user_transfer_recipient_notification",
          recipientEmail: recEmail,
          recipientUserId: transfer.recipient_id,
          variables: {
            recipient_name: recipientName,
            recipient_username: recipientUsername,
            sender_name: senderName,
            sender_username: senderUsername,
            amount,
            currency: "USD",
            reference_id: referenceId,
            created_at: completedAt,
          },
          supabaseClient: supabase,
        });
      }
    } catch (e) {
      console.error("[verify-user-transfer-otp] recipient email", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        reference_id: referenceId,
        new_deposit_balance: newDepositBalance,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[verify-user-transfer-otp-and-execute]", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
