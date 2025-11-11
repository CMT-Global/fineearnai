import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ========== PHASE 2: CONFIGURATION ==========
const EDGE_FUNCTION_TIMEOUT_MS = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000; // Initial retry delay
const TRANSIENT_ERROR_CODES = ['40001', '40P01', '08000', '08003', '08006', '08P01', '57014', '57P01'];

interface VoucherPurchaseRequest {
  voucher_amount: number;
  recipient_username?: string;
  recipient_email?: string;
  notes?: string;
}

// Explicit type for atomic function parameters
interface AtomicFunctionParams {
  p_partner_id: string;
  p_voucher_code: string;
  p_voucher_amount: number;
  p_amount: number;
  p_commission_rate: number;
  p_notes: string | null;
  p_recipient_username: string | null;
  p_recipient_email: string | null;
  p_expires_at: string;
}

// Checkpoint markers for detailed error tracking
enum CheckpointStage {
  START = 'START',
  CORS_CHECK = 'CORS_CHECK',
  AUTH = 'AUTH',
  ROLE_VERIFICATION = 'ROLE_VERIFICATION',
  REQUEST_VALIDATION = 'REQUEST_VALIDATION',
  PARTNER_CONFIG_FETCH = 'PARTNER_CONFIG_FETCH',
  COMMISSION_RATE_FETCH = 'COMMISSION_RATE_FETCH',
  BALANCE_FETCH = 'BALANCE_FETCH',
  BALANCE_CHECK = 'BALANCE_CHECK',
  VOUCHER_CODE_GENERATION = 'VOUCHER_CODE_GENERATION',
  ATOMIC_TRANSACTION_START = 'ATOMIC_TRANSACTION_START',
  ATOMIC_TRANSACTION_COMPLETE = 'ATOMIC_TRANSACTION_COMPLETE',
  NOTIFICATION = 'NOTIFICATION',
  SUCCESS = 'SUCCESS',
}

// ========== PHASE 2: HELPER FUNCTIONS ==========

// Generate correlation ID for tracking this request
function generateCorrelationId(): string {
  return `voucher-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Checkpoint logger with stage tracking
function logCheckpoint(
  correlationId: string,
  stage: CheckpointStage,
  data?: Record<string, any>
) {
  const timestamp = new Date().toISOString();
  console.log(`[${correlationId}] [${timestamp}] CHECKPOINT: ${stage}`, data || {});
}

// Check if error is transient and retryable
function isTransientError(error: any): boolean {
  if (!error) return false;
  
  // Check PostgreSQL error codes for transient failures
  const errorCode = error.code || error.error_code || error.sqlState;
  if (errorCode && TRANSIENT_ERROR_CODES.includes(errorCode)) {
    return true;
  }
  
  // Check error messages
  const message = (error.message || '').toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('temporary') ||
    message.includes('lock') ||
    message.includes('deadlock')
  );
}

// Retry logic with exponential backoff
async function retryWithBackoff<T>(
  correlationId: string,
  operationName: string,
  operation: () => Promise<T>,
  maxAttempts: number = MAX_RETRY_ATTEMPTS
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[${correlationId}] Attempt ${attempt}/${maxAttempts} for ${operationName}`);
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Only retry if it's a transient error and we have attempts left
      if (attempt < maxAttempts && isTransientError(error)) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff
        console.warn(
          `[${correlationId}] Transient error in ${operationName} (attempt ${attempt}/${maxAttempts}):`,
          error.message,
          `Retrying in ${delay}ms...`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Non-transient error or out of retries
        console.error(
          `[${correlationId}] Failed ${operationName} after ${attempt} attempt(s):`,
          error
        );
        throw error;
      }
    }
  }
  
  throw lastError;
}

// Timeout wrapper for long-running operations
async function withTimeout<T>(
  correlationId: string,
  operationName: string,
  operation: Promise<T>,
  timeoutMs: number = EDGE_FUNCTION_TIMEOUT_MS
): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Operation ${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  return Promise.race([operation, timeoutPromise]);
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
  logCheckpoint(correlationId, CheckpointStage.START);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    logCheckpoint(correlationId, CheckpointStage.CORS_CHECK);
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

    // Authenticate user with retry logic
    logCheckpoint(correlationId, CheckpointStage.AUTH, { stage: 'starting' });
    
    const { data: { user }, error: authError } = await retryWithBackoff(
      correlationId,
      'authentication',
      () => supabaseClient.auth.getUser()
    );

    if (authError || !user) {
      console.error(`[${correlationId}] ❌ Authentication failed:`, authError);
      logCheckpoint(correlationId, CheckpointStage.AUTH, { 
        stage: 'failed',
        error: authError?.message 
      });
      await logMetric(
        supabaseClient,
        correlationId,
        null,
        false,
        Date.now() - startTime,
        { ...metadata, checkpoint: CheckpointStage.AUTH },
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
    logCheckpoint(correlationId, CheckpointStage.AUTH, { 
      stage: 'success',
      user_id: userId 
    });
    console.log(`[${correlationId}] ✅ Authenticated user: ${userId}`);

    // Verify user is a partner with retry logic
    logCheckpoint(correlationId, CheckpointStage.ROLE_VERIFICATION, { stage: 'starting' });
    
    const { data: partnerRole } = await retryWithBackoff(
      correlationId,
      'role_verification',
      () => supabaseClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "partner")
        .single()
    );

    if (!partnerRole) {
      console.error(`[${correlationId}] ❌ User is not a partner`);
      logCheckpoint(correlationId, CheckpointStage.ROLE_VERIFICATION, { 
        stage: 'failed',
        reason: 'not_partner' 
      });
      await logMetric(
        supabaseClient,
        correlationId,
        userId,
        false,
        Date.now() - startTime,
        { ...metadata, checkpoint: CheckpointStage.ROLE_VERIFICATION },
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
    
    logCheckpoint(correlationId, CheckpointStage.ROLE_VERIFICATION, { stage: 'success' });

    logCheckpoint(correlationId, CheckpointStage.REQUEST_VALIDATION, { stage: 'starting' });
    
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
      logCheckpoint(correlationId, CheckpointStage.REQUEST_VALIDATION, { 
        stage: 'failed',
        reason: 'invalid_amount',
        amount: body.voucher_amount 
      });
      await logMetric(
        supabaseClient,
        correlationId,
        userId,
        false,
        Date.now() - startTime,
        { ...metadata, checkpoint: CheckpointStage.REQUEST_VALIDATION, invalid_amount: body.voucher_amount },
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
    
    logCheckpoint(correlationId, CheckpointStage.REQUEST_VALIDATION, { stage: 'success' });

    // Get partner config and commission rate with retry logic
    logCheckpoint(correlationId, CheckpointStage.PARTNER_CONFIG_FETCH, { stage: 'starting' });
    
    const { data: partnerConfig } = await retryWithBackoff(
      correlationId,
      'partner_config_fetch',
      () => supabaseClient
        .from("partner_config")
        .select("*")
        .eq("user_id", user.id)
        .single()
    );

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

    logCheckpoint(correlationId, CheckpointStage.PARTNER_CONFIG_FETCH, { 
      stage: 'success',
      is_active: partnerConfig.is_active,
      current_rank: partnerConfig.current_rank 
    });
    
    console.log(`[${correlationId}] ✅ Partner config loaded:`, {
      is_active: partnerConfig.is_active,
      current_rank: partnerConfig.current_rank,
      total_vouchers_sold: partnerConfig.total_vouchers_sold,
    });

    // Get commission rate using database function with retry logic
    logCheckpoint(correlationId, CheckpointStage.COMMISSION_RATE_FETCH, { stage: 'starting' });
    
    const { data: commissionRateData, error: commissionError } = await retryWithBackoff(
      correlationId,
      'commission_rate_fetch',
      () => supabaseClient.rpc("get_partner_commission_rate", { p_user_id: user.id })
    );

    if (commissionError) {
      console.error(`[${correlationId}] ❌ Error getting commission rate:`, commissionError);
      logCheckpoint(correlationId, CheckpointStage.COMMISSION_RATE_FETCH, { 
        stage: 'failed',
        error: commissionError.message 
      });
      await logMetric(
        supabaseClient,
        correlationId,
        userId,
        false,
        Date.now() - startTime,
        { ...metadata, checkpoint: CheckpointStage.COMMISSION_RATE_FETCH },
        commissionError.message
      );
      throw commissionError;
    }
    
    logCheckpoint(correlationId, CheckpointStage.COMMISSION_RATE_FETCH, { 
      stage: 'success',
      commission_rate: commissionRateData 
    });

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

    // Check partner's deposit wallet balance with retry logic
    logCheckpoint(correlationId, CheckpointStage.BALANCE_FETCH, { stage: 'starting' });
    
    const { data: profile, error: profileError } = await retryWithBackoff(
      correlationId,
      'balance_fetch',
      () => supabaseClient
        .from("profiles")
        .select("deposit_wallet_balance, username")
        .eq("id", user.id)
        .single()
    );

    if (profileError) {
      console.error(`[${correlationId}] ❌ Error fetching profile:`, profileError);
      logCheckpoint(correlationId, CheckpointStage.BALANCE_FETCH, { 
        stage: 'failed',
        error: profileError.message 
      });
      await logMetric(
        supabaseClient,
        correlationId,
        userId,
        false,
        Date.now() - startTime,
        { ...metadata, checkpoint: CheckpointStage.BALANCE_FETCH },
        profileError.message
      );
      throw profileError;
    }
    
    logCheckpoint(correlationId, CheckpointStage.BALANCE_FETCH, { 
      stage: 'success',
      balance: profile.deposit_wallet_balance 
    });

    const oldBalance = profile.deposit_wallet_balance;
    const expectedNewBalance = Number((oldBalance - partner_paid_amount).toFixed(2));

    metadata.old_balance = oldBalance;
    metadata.expected_new_balance = expectedNewBalance;
    metadata.balance_difference = partner_paid_amount;
    
    logCheckpoint(correlationId, CheckpointStage.BALANCE_CHECK, { 
      current_balance: oldBalance,
      required_amount: partner_paid_amount,
      sufficient: oldBalance >= partner_paid_amount 
    });

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
      logCheckpoint(correlationId, CheckpointStage.BALANCE_CHECK, { 
        stage: 'failed',
        reason: 'insufficient_balance',
        shortage: partner_paid_amount - profile.deposit_wallet_balance 
      });
      await logMetric(
        supabaseClient,
        correlationId,
        userId,
        false,
        Date.now() - startTime,
        {
          ...metadata,
          checkpoint: CheckpointStage.BALANCE_CHECK,
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
    logCheckpoint(correlationId, CheckpointStage.ATOMIC_TRANSACTION_START);
    console.log(`[${correlationId}] 🔄 Starting atomic transaction...`);

    // Step 1: Generate unique voucher code with retry logic
    logCheckpoint(correlationId, CheckpointStage.VOUCHER_CODE_GENERATION, { stage: 'starting' });
    const codeGenStartTime = Date.now();
    
    const { data: voucherCode, error: codeError } = await retryWithBackoff(
      correlationId,
      'voucher_code_generation',
      () => supabaseClient.rpc("generate_voucher_code")
    );
    
    const codeGenDuration = Date.now() - codeGenStartTime;

    if (codeError) {
      console.error(`[${correlationId}] ❌ Error generating voucher code:`, codeError);
      logCheckpoint(correlationId, CheckpointStage.VOUCHER_CODE_GENERATION, { 
        stage: 'failed',
        error: codeError.message,
        duration_ms: codeGenDuration 
      });
      await logMetric(
        supabaseClient,
        correlationId,
        userId,
        false,
        Date.now() - startTime,
        { ...metadata, checkpoint: CheckpointStage.VOUCHER_CODE_GENERATION, code_gen_duration: codeGenDuration },
        codeError.message
      );
      throw codeError;
    }

    metadata.voucher_code = voucherCode;
    logCheckpoint(correlationId, CheckpointStage.VOUCHER_CODE_GENERATION, { 
      stage: 'success',
      voucher_code: voucherCode,
      duration_ms: codeGenDuration 
    });
    console.log(`[${correlationId}] ✅ Generated voucher code: ${voucherCode} (${codeGenDuration}ms)`);

    // Step 2: Execute atomic purchase via database function with explicit signature and timeout
    const atomicFunctionStartTime = Date.now();
    
    // PHASE 2: Explicit parameter typing for type safety
    const atomicParams: AtomicFunctionParams = {
      p_partner_id: user.id,
      p_voucher_code: voucherCode,
      p_voucher_amount: body.voucher_amount,
      p_amount: partner_paid_amount,
      p_commission_rate: commission_rate,
      p_notes: body.notes || null,
      p_recipient_username: body.recipient_username || null,
      p_recipient_email: body.recipient_email || null,
      p_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year expiry
    };
    
    console.log(`[${correlationId}] 🔐 Executing atomic function with params:`, atomicParams);
    
    // PHASE 2: Wrap atomic operation with timeout and retry logic
    const { data: result, error: purchaseError } = await withTimeout(
      correlationId,
      'atomic_transaction',
      retryWithBackoff(
        correlationId,
        'atomic_transaction',
        () => supabaseClient.rpc("purchase_voucher_atomic", atomicParams)
      ),
      EDGE_FUNCTION_TIMEOUT_MS
    );

    const atomicFunctionDuration = Date.now() - atomicFunctionStartTime;
    metadata.atomic_function_duration_ms = atomicFunctionDuration;

    if (purchaseError) {
      console.error(`[${correlationId}] ❌ Atomic function error:`, {
        error: purchaseError,
        duration_ms: atomicFunctionDuration,
        expected_balance_change: partner_paid_amount,
        is_transient: isTransientError(purchaseError),
      });
      logCheckpoint(correlationId, CheckpointStage.ATOMIC_TRANSACTION_START, { 
        stage: 'failed',
        error: purchaseError.message,
        duration_ms: atomicFunctionDuration,
        is_transient: isTransientError(purchaseError)
      });
      await logMetric(
        supabaseClient,
        correlationId,
        userId,
        false,
        Date.now() - startTime,
        {
          ...metadata,
          checkpoint: CheckpointStage.ATOMIC_TRANSACTION_START,
          atomic_function_duration_ms: atomicFunctionDuration,
          error_transient: isTransientError(purchaseError),
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
      logCheckpoint(correlationId, CheckpointStage.ATOMIC_TRANSACTION_START, { 
        stage: 'business_logic_failed',
        error: result?.error,
        error_code: result?.error_code,
        duration_ms: atomicFunctionDuration 
      });
      await logMetric(
        supabaseClient,
        correlationId,
        userId,
        false,
        Date.now() - startTime,
        {
          ...metadata,
          checkpoint: CheckpointStage.ATOMIC_TRANSACTION_START,
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
    metadata.new_balance = result.partner_new_balance;
    metadata.actual_balance_change = oldBalance - result.partner_new_balance;
    metadata.balance_match = Math.abs(metadata.actual_balance_change - partner_paid_amount) < 0.01;
    metadata.auto_redeemed = result.auto_redeemed;
    
    logCheckpoint(correlationId, CheckpointStage.ATOMIC_TRANSACTION_COMPLETE, {
      duration_ms: atomicTotalDuration,
      voucher_id: result.voucher_id,
      status: result.status,
      auto_redeemed: result.auto_redeemed
    });

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
    logCheckpoint(correlationId, CheckpointStage.NOTIFICATION, { stage: 'starting' });
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
      
      logCheckpoint(correlationId, CheckpointStage.NOTIFICATION, { stage: 'success' });
      
      // TODO: Send email to recipient notifying them of the credit
      // This would require a new edge function or email template
    } catch (notificationError: any) {
      console.error(`[${correlationId}] ⚠️  Notification failed (non-critical):`, notificationError.message);
      logCheckpoint(correlationId, CheckpointStage.NOTIFICATION, { 
        stage: 'failed',
        error: notificationError.message,
        critical: false 
      });
      // Log but don't fail the purchase if notifications fail
      await logMetric(
        supabaseClient,
        correlationId,
        userId,
        true, // Still successful purchase
        Date.now() - startTime,
        { 
          ...metadata, 
          notification_failed: true,
          notification_error: notificationError.message 
        }
      );
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

    logCheckpoint(correlationId, CheckpointStage.SUCCESS, { total_duration_ms: totalDuration });
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
      code: error.code,
      sqlState: error.sqlState,
      stack: error.stack,
      metadata,
      is_transient: isTransientError(error),
    });

    // Only log metric if supabaseClient was successfully created
    if (supabaseClient) {
      await logMetric(
        supabaseClient,
        correlationId,
        userId,
        false,
        totalDuration,
        { 
          ...metadata, 
          checkpoint: 'unexpected_error',
          error_name: error.name,
          error_code: error.code,
          error_transient: isTransientError(error)
        },
        error.message
      );
    }

    // Return appropriate status code based on error type
    const statusCode = error.message?.includes('timeout') ? 504 : 
                      error.message?.includes('Unauthorized') ? 401 : 500;

    return new Response(
      JSON.stringify({ 
        error: error.message,
        error_code: error.code || 'UNEXPECTED_ERROR',
        is_transient: isTransientError(error),
        correlation_id: correlationId
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
