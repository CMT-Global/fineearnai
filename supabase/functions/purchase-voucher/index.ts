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

// Generate correlation ID for tracking this request
function generateCorrelationId(): string {
  return `voucher-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Log to edge_function_metrics for monitoring
async function logMetric(
  supabaseClient: any,
  correlationId: string,
  userId: string | null,
  success: boolean,
  executionTimeMs: number,
  metadata: Record<string, any>,
  errorMessage?: string
) {
  try {
    await supabaseClient.from("edge_function_metrics").insert({
      function_name: "purchase-voucher",
      user_id: userId,
      success,
      execution_time_ms: executionTimeMs,
      metadata: {
        correlation_id: correlationId,
        ...metadata,
      },
      error_message: errorMessage,
    });
  } catch (err) {
    console.error("[Metrics] Failed to log metric:", err);
  }
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const correlationId = generateCorrelationId();
  let userId: string | null = null;
  let metadata: Record<string, any> = { correlation_id: correlationId };
  let supabaseClient: any = null;

  console.log(`[${correlationId}] ========== VOUCHER PURCHASE REQUEST START ==========`);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    supabaseClient = createClient(
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
      console.error(`[${correlationId}] ❌ Authentication failed:`, authError);
      await logMetric(
        supabaseClient,
        correlationId,
        null,
        false,
        Date.now() - startTime,
        { ...metadata, error_stage: "authentication" },
        authError?.message || "Unauthorized"
      );
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    userId = user.id;
    metadata.user_id = userId;
    console.log(`[${correlationId}] ✅ Authenticated user: ${userId}`);

    // Verify user is a partner
    const { data: partnerRole } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "partner")
      .single();

    if (!partnerRole) {
      console.error(`[${correlationId}] ❌ User is not a partner`);
      await logMetric(
        supabaseClient,
        correlationId,
        userId,
        false,
        Date.now() - startTime,
        { ...metadata, error_stage: "role_verification" },
        "User is not a partner"
      );
      return new Response(
        JSON.stringify({ error: "Only partners can purchase vouchers" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body: VoucherPurchaseRequest = await req.json();
    metadata.voucher_amount = body.voucher_amount;
    metadata.has_recipient_username = !!body.recipient_username;
    metadata.has_recipient_email = !!body.recipient_email;

    console.log(`[${correlationId}] 📋 Request details:`, {
      voucher_amount: body.voucher_amount,
      recipient_username: body.recipient_username,
      recipient_email: body.recipient_email,
      has_notes: !!body.notes,
    });

    // Validate voucher amount
    if (!body.voucher_amount || body.voucher_amount <= 0) {
      console.error(`[${correlationId}] ❌ Invalid voucher amount:`, body.voucher_amount);
      await logMetric(
        supabaseClient,
        correlationId,
        userId,
        false,
        Date.now() - startTime,
        { ...metadata, error_stage: "validation", invalid_amount: body.voucher_amount },
        "Invalid voucher amount"
      );
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
      console.error(`[${correlationId}] ❌ Partner config not found for user:`, userId);
      await logMetric(
        supabaseClient,
        correlationId,
        userId,
        false,
        Date.now() - startTime,
        { ...metadata, error_stage: "partner_config_fetch" },
        "Partner configuration not found"
      );
      return new Response(
        JSON.stringify({ error: "Partner configuration not found. Please contact support." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!partnerConfig.is_active) {
      console.error(`[${correlationId}] ❌ Partner account is not active`);
      await logMetric(
        supabaseClient,
        correlationId,
        userId,
        false,
        Date.now() - startTime,
        { ...metadata, error_stage: "partner_active_check" },
        "Partner account is not active"
      );
      return new Response(
        JSON.stringify({ error: "Partner account is not active" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[${correlationId}] ✅ Partner config loaded:`, {
      is_active: partnerConfig.is_active,
      current_rank: partnerConfig.current_rank,
      total_vouchers_sold: partnerConfig.total_vouchers_sold,
    });

    // Get commission rate using database function
    const { data: commissionRateData, error: commissionError } = await supabaseClient.rpc(
      "get_partner_commission_rate",
      { p_user_id: user.id }
    );

    if (commissionError) {
      console.error(`[${correlationId}] ❌ Error getting commission rate:`, commissionError);
      await logMetric(
        supabaseClient,
        correlationId,
        userId,
        false,
        Date.now() - startTime,
        { ...metadata, error_stage: "commission_rate_fetch" },
        commissionError.message
      );
      throw commissionError;
    }

    const commission_rate = commissionRateData as number;
    const commission_amount = body.voucher_amount * commission_rate;
    const partner_paid_amount = body.voucher_amount - commission_amount;

    // Log calculated amounts with precision tracking
    metadata.commission_rate = commission_rate;
    metadata.commission_amount = commission_amount;
    metadata.partner_paid_amount = partner_paid_amount;
    metadata.commission_amount_rounded = Number(commission_amount.toFixed(2));
    metadata.partner_paid_amount_rounded = Number(partner_paid_amount.toFixed(2));

    console.log(`[${correlationId}] 💰 Financial Calculation:`, {
      voucher_amount: body.voucher_amount,
      commission_rate,
      commission_amount,
      commission_amount_rounded: Number(commission_amount.toFixed(2)),
      partner_paid_amount,
      partner_paid_amount_rounded: Number(partner_paid_amount.toFixed(2)),
      rounding_difference_commission: commission_amount - Number(commission_amount.toFixed(2)),
      rounding_difference_partner: partner_paid_amount - Number(partner_paid_amount.toFixed(2)),
    });

    // Check partner's deposit wallet balance
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("deposit_wallet_balance, username")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error(`[${correlationId}] ❌ Error fetching profile:`, profileError);
      await logMetric(
        supabaseClient,
        correlationId,
        userId,
        false,
        Date.now() - startTime,
        { ...metadata, error_stage: "profile_fetch" },
        profileError.message
      );
      throw profileError;
    }

    const oldBalance = profile.deposit_wallet_balance;
    const expectedNewBalance = Number((oldBalance - partner_paid_amount).toFixed(2));

    metadata.old_balance = oldBalance;
    metadata.expected_new_balance = expectedNewBalance;
    metadata.balance_difference = partner_paid_amount;

    console.log(`[${correlationId}] 💵 Balance Check:`, {
      current_balance: oldBalance,
      required_amount: partner_paid_amount,
      expected_new_balance: expectedNewBalance,
      sufficient_funds: oldBalance >= partner_paid_amount,
      balance_after_rounding: Number(oldBalance.toFixed(2)),
    });

    if (profile.deposit_wallet_balance < partner_paid_amount) {
      console.error(`[${correlationId}] ❌ Insufficient balance:`, {
        current: profile.deposit_wallet_balance,
        required: partner_paid_amount,
        shortage: partner_paid_amount - profile.deposit_wallet_balance,
      });
      await logMetric(
        supabaseClient,
        correlationId,
        userId,
        false,
        Date.now() - startTime,
        {
          ...metadata,
          error_stage: "balance_check",
          current_balance: profile.deposit_wallet_balance,
          required_amount: partner_paid_amount,
          shortage: partner_paid_amount - profile.deposit_wallet_balance,
        },
        "Insufficient deposit wallet balance"
      );
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
    const atomicStartTime = Date.now();
    console.log(`[${correlationId}] 🔄 Starting atomic transaction...`);

    // Step 1: Generate unique voucher code
    const codeGenStartTime = Date.now();
    const { data: voucherCode, error: codeError } = await supabaseClient.rpc(
      "generate_voucher_code"
    );
    const codeGenDuration = Date.now() - codeGenStartTime;

    if (codeError) {
      console.error(`[${correlationId}] ❌ Error generating voucher code:`, codeError);
      await logMetric(
        supabaseClient,
        correlationId,
        userId,
        false,
        Date.now() - startTime,
        { ...metadata, error_stage: "voucher_code_generation", code_gen_duration: codeGenDuration },
        codeError.message
      );
      throw codeError;
    }

    metadata.voucher_code = voucherCode;
    console.log(`[${correlationId}] ✅ Generated voucher code: ${voucherCode} (${codeGenDuration}ms)`);

    // Step 2: Execute atomic purchase via database function
    const atomicFunctionStartTime = Date.now();
    console.log(`[${correlationId}] 🔐 Executing atomic function with params:`, {
      partner_id: user.id,
      voucher_code: voucherCode,
      voucher_amount: body.voucher_amount,
      partner_paid_amount,
      commission_amount,
      commission_rate,
    });

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

    const atomicFunctionDuration = Date.now() - atomicFunctionStartTime;
    metadata.atomic_function_duration_ms = atomicFunctionDuration;

    if (purchaseError) {
      console.error(`[${correlationId}] ❌ Atomic function error:`, {
        error: purchaseError,
        duration_ms: atomicFunctionDuration,
        expected_balance_change: partner_paid_amount,
      });
      await logMetric(
        supabaseClient,
        correlationId,
        userId,
        false,
        Date.now() - startTime,
        {
          ...metadata,
          error_stage: "atomic_function_execution",
          atomic_function_duration_ms: atomicFunctionDuration,
        },
        purchaseError.message
      );
      throw purchaseError;
    }

    // Check if the atomic function returned an error
    if (!result || !result.success) {
      console.error(`[${correlationId}] ❌ Atomic operation failed:`, {
        result,
        duration_ms: atomicFunctionDuration,
        expected_new_balance: expectedNewBalance,
      });
      await logMetric(
        supabaseClient,
        correlationId,
        userId,
        false,
        Date.now() - startTime,
        {
          ...metadata,
          error_stage: "atomic_operation_failed",
          atomic_function_duration_ms: atomicFunctionDuration,
          function_result: result,
        },
        result?.error || "Voucher purchase failed"
      );
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

    const atomicTotalDuration = Date.now() - atomicStartTime;
    metadata.atomic_total_duration_ms = atomicTotalDuration;
    metadata.new_balance = result.new_balance;
    metadata.actual_balance_change = oldBalance - result.new_balance;
    metadata.balance_match = Math.abs(metadata.actual_balance_change - partner_paid_amount) < 0.01;
    metadata.recipient_credited = result.recipient_credited;
    metadata.auto_redeemed = result.auto_redeemed;

    console.log(`[${correlationId}] ✅ Atomic transaction complete (AUTO-REDEEMED)!`, {
      partner_transaction_id: result.partner_transaction_id,
      recipient_transaction_id: result.recipient_transaction_id,
      voucher_id: result.voucher_id,
      voucher_code: result.voucher_code,
      partner_old_balance: result.partner_old_balance,
      partner_new_balance: result.partner_new_balance,
      recipient_old_balance: result.recipient_old_balance,
      recipient_new_balance: result.recipient_new_balance,
      expected_new_balance: expectedNewBalance,
      balance_difference: result.partner_new_balance - expectedNewBalance,
      balance_match: metadata.balance_match,
      amount_charged: result.amount_charged,
      commission_earned: result.commission_earned,
      voucher_amount: result.voucher_amount,
      recipient_id: result.recipient_id,
      recipient_username: result.recipient_username,
      recipient_credited: result.recipient_credited,
      auto_redeemed: result.auto_redeemed,
      new_rank: result.new_rank,
      duration_ms: atomicTotalDuration,
    });

    // Step 3: Send notifications (non-blocking)
    try {
      // Notify partner about successful purchase
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
            recipient_username: result.recipient_username,
            auto_redeemed: true,
          },
        }),
      });
      
      // TODO: Send email to recipient notifying them of the credit
      // This would require a new edge function or email template
    } catch (emailError) {
      console.error('[Purchase Voucher] Failed to send notifications:', emailError);
      // Don't fail the purchase if notifications fail
    }

    const totalDuration = Date.now() - startTime;
    metadata.total_duration_ms = totalDuration;
    metadata.success = true;

    // Log successful purchase
    await logMetric(
      supabaseClient,
      correlationId,
      userId,
      true,
      totalDuration,
      metadata
    );

    console.log(`[${correlationId}] ========== VOUCHER PURCHASE SUCCESS (${totalDuration}ms) ==========`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Voucher purchased and funds sent successfully",
        partner_transaction: {
          id: result.partner_transaction_id,
          old_balance: result.partner_old_balance,
          new_balance: result.partner_new_balance,
          amount_charged: result.amount_charged,
          commission_earned: result.commission_earned,
        },
        recipient: {
          id: result.recipient_id,
          username: result.recipient_username,
          transaction_id: result.recipient_transaction_id,
          old_balance: result.recipient_old_balance,
          new_balance: result.recipient_new_balance,
          amount_credited: result.voucher_amount,
          credited_instantly: true,
        },
        voucher: {
          id: result.voucher_id,
          voucher_code: result.voucher_code,
          amount: result.voucher_amount,
          status: 'redeemed',
          redeemed_at: result.redeemed_at,
          expires_at: result.expires_at,
          auto_redeemed: true,
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
    const totalDuration = Date.now() - startTime;
    console.error(`[${correlationId}] ❌ ========== UNEXPECTED ERROR (${totalDuration}ms) ==========`);
    console.error(`[${correlationId}] Error details:`, {
      message: error.message,
      name: error.name,
      stack: error.stack,
      metadata,
    });

    // Only log metric if supabaseClient was successfully created
    if (supabaseClient) {
      await logMetric(
        supabaseClient,
        correlationId,
        userId,
        false,
        totalDuration,
        { ...metadata, error_stage: "unexpected_error", error_name: error.name },
        error.message
      );
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
