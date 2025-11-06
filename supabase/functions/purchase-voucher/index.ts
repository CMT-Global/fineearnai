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

    // ATOMIC TRANSACTION: Deduct balance, create voucher, update stats
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

    // Step 2: Deduct from partner's deposit wallet
    const new_balance = profile.deposit_wallet_balance - partner_paid_amount;

    const { error: updateBalanceError } = await supabaseClient
      .from("profiles")
      .update({
        deposit_wallet_balance: new_balance,
        last_activity: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateBalanceError) {
      console.error("[Purchase Voucher] Error updating balance:", updateBalanceError);
      throw updateBalanceError;
    }

    console.log("[Purchase Voucher] Balance updated:", {
      old_balance: profile.deposit_wallet_balance,
      new_balance,
    });

    // Step 3: Create transaction record for voucher purchase
    const { data: transaction, error: transactionError } = await supabaseClient
      .from("transactions")
      .insert({
        user_id: user.id,
        type: "transfer",
        amount: partner_paid_amount,
        wallet_type: "deposit",
        new_balance: new_balance,
        status: "completed",
        description: `Purchased voucher code: ${voucherCode}`,
        metadata: {
          voucher_code: voucherCode,
          voucher_amount: body.voucher_amount,
          commission_amount,
          commission_rate,
          recipient_username: body.recipient_username,
          recipient_email: body.recipient_email,
        },
      })
      .select()
      .single();

    if (transactionError) {
      console.error("[Purchase Voucher] Error creating transaction:", transactionError);
      throw transactionError;
    }

    console.log(`[Purchase Voucher] Transaction created: ${transaction.id}`);

    // Step 4: Create voucher record
    const voucher_expires_at = new Date();
    voucher_expires_at.setDate(voucher_expires_at.getDate() + 30); // 30 days expiry

    const { data: voucher, error: voucherError } = await supabaseClient
      .from("vouchers")
      .insert({
        voucher_code: voucherCode,
        partner_id: user.id,
        voucher_amount: body.voucher_amount,
        partner_paid_amount,
        commission_amount,
        commission_rate,
        status: "active",
        expires_at: voucher_expires_at.toISOString(),
        purchase_transaction_id: transaction.id,
        notes: body.notes,
      })
      .select()
      .single();

    if (voucherError) {
      console.error("[Purchase Voucher] Error creating voucher:", voucherError);
      throw voucherError;
    }

    console.log(`[Purchase Voucher] Voucher created: ${voucher.id}`);

    // Step 5: Update partner stats
    const { error: updateStatsError } = await supabaseClient
      .from("partner_config")
      .update({
        total_vouchers_sold: partnerConfig.total_vouchers_sold + 1,
        total_commission_earned: partnerConfig.total_commission_earned + commission_amount,
        daily_sales: partnerConfig.daily_sales + body.voucher_amount,
        weekly_sales: partnerConfig.weekly_sales + body.voucher_amount,
        last_sale_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateStatsError) {
      console.error("[Purchase Voucher] Error updating stats:", updateStatsError);
      throw updateStatsError;
    }

    console.log("[Purchase Voucher] Partner stats updated");

    // Step 6: Update partner rank
    const { data: newRank, error: rankError } = await supabaseClient.rpc(
      "update_partner_rank",
      { p_partner_id: user.id }
    );

    if (rankError) {
      console.error("[Purchase Voucher] Error updating rank:", rankError);
    } else {
      console.log(`[Purchase Voucher] Rank updated to: ${newRank}`);
    }

    // Step 7: Log activity
    const { error: activityError } = await supabaseClient
      .from("partner_activity_log")
      .insert({
        partner_id: user.id,
        activity_type: "voucher_purchased",
        details: {
          voucher_code: voucherCode,
          voucher_amount: body.voucher_amount,
          commission_amount,
          recipient_username: body.recipient_username,
          recipient_email: body.recipient_email,
        },
        voucher_id: voucher.id,
        transaction_id: transaction.id,
      });

    if (activityError) {
      console.error("[Purchase Voucher] Error logging activity:", activityError);
    }

    console.log("[Purchase Voucher] Transaction complete!");

    return new Response(
      JSON.stringify({
        success: true,
        voucher: {
          id: voucher.id,
          voucher_code: voucherCode,
          amount: body.voucher_amount,
          expires_at: voucher_expires_at.toISOString(),
        },
        transaction: {
          id: transaction.id,
          amount_paid: partner_paid_amount,
          commission_earned: commission_amount,
          new_balance,
        },
        partner_stats: {
          total_vouchers_sold: partnerConfig.total_vouchers_sold + 1,
          daily_sales: partnerConfig.daily_sales + body.voucher_amount,
          current_rank: newRank || partnerConfig.current_rank,
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
