import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VoucherPurchaseRequest {
  voucher_amount: number;
  recipient_username?: string;
  recipient_email?: string;
  notes?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error("[Purchase Voucher] Authentication failed:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[Purchase Voucher] Request from user: ${user.id}`);

    // Verify user is a partner
    const { data: partnerRole } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "partner")
      .single();

    if (!partnerRole) {
      console.error("[Purchase Voucher] User is not a partner");
      return new Response(
        JSON.stringify({ error: "Only partners can purchase vouchers" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body: VoucherPurchaseRequest = await req.json();

    console.log("[Purchase Voucher] Request:", {
      voucher_amount: body.voucher_amount,
      recipient_username: body.recipient_username,
      recipient_email: body.recipient_email,
    });

    // Validate voucher amount
    if (!body.voucher_amount || body.voucher_amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid voucher amount" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get partner config and commission rate
    const { data: partnerConfig } = await supabaseClient
      .from("partner_config")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!partnerConfig) {
      console.error("[Purchase Voucher] Partner config not found");
      return new Response(
        JSON.stringify({ error: "Partner configuration not found. Please contact support." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!partnerConfig.is_active) {
      return new Response(
        JSON.stringify({ error: "Partner account is not active" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get commission rate using database function
    const { data: commissionRateData, error: commissionError } = await supabaseClient.rpc(
      "get_partner_commission_rate",
      { p_user_id: user.id }
    );

    if (commissionError) {
      console.error("[Purchase Voucher] Error getting commission rate:", commissionError);
      throw commissionError;
    }

    const commission_rate = commissionRateData as number;
    const commission_amount = body.voucher_amount * commission_rate;
    const partner_paid_amount = body.voucher_amount - commission_amount;

    console.log("[Purchase Voucher] Calculation:", {
      voucher_amount: body.voucher_amount,
      commission_rate,
      commission_amount,
      partner_paid_amount,
    });

    // Check partner's deposit wallet balance
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("deposit_wallet_balance, username")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("[Purchase Voucher] Error fetching profile:", profileError);
      throw profileError;
    }

    if (profile.deposit_wallet_balance < partner_paid_amount) {
      console.error("[Purchase Voucher] Insufficient balance:", {
        current: profile.deposit_wallet_balance,
        required: partner_paid_amount,
      });
      return new Response(
        JSON.stringify({
          error: "Insufficient deposit wallet balance",
          current_balance: profile.deposit_wallet_balance,
          required_amount: partner_paid_amount,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ATOMIC TRANSACTION: Use database function for all-or-nothing execution
    console.log("[Purchase Voucher] Starting atomic transaction...");

    // Step 1: Generate unique voucher code
    const { data: voucherCode, error: codeError } = await supabaseClient.rpc(
      "generate_voucher_code"
    );

    if (codeError) {
      console.error("[Purchase Voucher] Error generating voucher code:", codeError);
      throw codeError;
    }

    console.log(`[Purchase Voucher] Generated voucher code: ${voucherCode}`);

    // Step 2: Execute atomic purchase via database function
    const { data: result, error: purchaseError } = await supabaseClient.rpc(
      "purchase_voucher_atomic",
      {
        p_partner_id: user.id,
        p_voucher_code: voucherCode,
        p_voucher_amount: body.voucher_amount,
        p_partner_paid_amount: partner_paid_amount,
        p_commission_amount: commission_amount,
        p_commission_rate: commission_rate,
        p_notes: body.notes || null,
        p_recipient_username: body.recipient_username || null,
        p_recipient_email: body.recipient_email || null,
      }
    );

    if (purchaseError) {
      console.error("[Purchase Voucher] Atomic function error:", purchaseError);
      throw purchaseError;
    }

    // Check if the atomic function returned an error
    if (!result || !result.success) {
      console.error("[Purchase Voucher] Atomic operation failed:", result);
      return new Response(
        JSON.stringify({
          error: result?.error || "Voucher purchase failed",
          error_code: result?.error_code || "UNKNOWN_ERROR",
          details: result,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("[Purchase Voucher] Atomic transaction complete!", {
      transaction_id: result.transaction_id,
      voucher_id: result.voucher_id,
      new_balance: result.new_balance,
      new_rank: result.new_rank,
    });

    // Step 3: Send purchase confirmation email
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-partner-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization') || '',
        },
        body: JSON.stringify({
          user_id: user.id,
          notification_type: 'voucher_purchased',
          data: {
            voucher_code: result.voucher_code,
            voucher_amount: body.voucher_amount,
          },
        }),
      });
    } catch (emailError) {
      console.error('[Purchase Voucher] Failed to send purchase notification:', emailError);
      // Don't fail the purchase if email fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        voucher: {
          id: result.voucher_id,
          voucher_code: result.voucher_code,
          amount: body.voucher_amount,
          expires_at: result.expires_at,
        },
        transaction: {
          id: result.transaction_id,
          amount_paid: partner_paid_amount,
          commission_earned: result.commission_earned,
          new_balance: result.new_balance,
        },
        partner_stats: {
          total_vouchers_sold: result.total_vouchers_sold,
          daily_sales: result.daily_sales,
          current_rank: result.new_rank,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[Purchase Voucher] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
