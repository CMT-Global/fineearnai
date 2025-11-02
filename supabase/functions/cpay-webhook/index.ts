import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTemplateEmail } from "../_shared/email-sender.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiter: Track requests per IP with sliding window
const rateLimiter = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // Max requests per minute per IP
const RATE_WINDOW = 60 * 1000; // 1 minute in milliseconds

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimiter.entries()) {
    if (now > data.resetTime) {
      rateLimiter.delete(ip);
    }
  }
}, 5 * 60 * 1000);

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimiter.get(ip);

  if (!record || now > record.resetTime) {
    // New window or expired window
    rateLimiter.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    console.warn(`Rate limit exceeded for IP: ${ip}`);
    return false;
  }

  record.count++;
  return true;
}

// ============= WITHDRAWAL WEBHOOK HANDLERS =============

async function handleWithdrawalCompletion(
  supabase: any,
  withdrawal: any,
  cpayId: string,
  webhookData: any,
  clientIP: string
) {
  console.log(`[CPAY-WEBHOOK] 💚 Processing withdrawal completion: ${withdrawal.id}`);
  
  const txHash = webhookData.hash || webhookData.transactionHash || webhookData.txHash || null;
  const completedAt = new Date().toISOString();
  
  // 1. Update withdrawal_requests to completed
  const { error: wrUpdateError } = await supabase
    .from('withdrawal_requests')
    .update({
      status: 'completed',
      processed_at: completedAt,
      manual_txn_hash: txHash,
      api_response: {
        ...withdrawal.api_response,
        status: 'completed',
        transaction_hash: txHash,
        webhook_received_at: completedAt,
        cpay_status: webhookData.systemStatus || webhookData.chargeStatus,
        webhook_ip: clientIP
      }
    })
    .eq('id', withdrawal.id)
    .eq('status', 'processing'); // Safety check
  
  if (wrUpdateError) {
    console.error('[CPAY-WEBHOOK] ❌ Failed to update withdrawal_requests:', wrUpdateError);
    throw new Error('Failed to update withdrawal status');
  }
  
  // 2. Update corresponding transaction to completed
  const { error: txUpdateError } = await supabase
    .from('transactions')
    .update({ 
      status: 'completed',
      gateway_transaction_id: cpayId,
      metadata: {
        completed_via_webhook: true,
        webhook_received_at: completedAt,
        transaction_hash: txHash,
        withdrawal_request_id: withdrawal.id
      }
    })
    .eq('type', 'withdrawal')
    .eq('user_id', withdrawal.user_id)
    .contains('metadata', { withdrawal_request_id: withdrawal.id })
    .eq('status', 'pending');
  
  if (txUpdateError) {
    console.warn('[CPAY-WEBHOOK] ⚠️ Failed to update transaction (withdrawal still marked complete):', txUpdateError);
  }
  
  // 3. Send user notification
  try {
    await supabase.functions.invoke('send-cpay-notification', {
      body: {
        user_id: withdrawal.user_id,
        type: 'withdrawal_completed',
        data: {
          amount: withdrawal.amount,
          net_amount: withdrawal.net_amount,
          transaction_hash: txHash,
          withdrawal_id: withdrawal.id
        }
      }
    });
  } catch (notifError) {
    console.warn('[CPAY-WEBHOOK] ⚠️ Notification failed (non-critical):', notifError);
  }
  
  console.log(
    `[CPAY-WEBHOOK] ✅ WITHDRAWAL COMPLETED: ` +
    `User ${withdrawal.profiles.username}, Amount: $${withdrawal.amount}, ` +
    `TxHash: ${txHash || 'N/A'}`
  );
}

async function handleWithdrawalFailure(
  supabase: any,
  withdrawal: any,
  cpayId: string,
  webhookData: any,
  clientIP: string
) {
  console.log(`[CPAY-WEBHOOK] ⚠️ Processing withdrawal failure: ${withdrawal.id}`);
  
  const failureReason = webhookData.failureReason || 
                       webhookData.error || 
                       'CPAY withdrawal failed - status: ' + (webhookData.systemStatus || webhookData.chargeStatus);
  const failedAt = new Date().toISOString();
  
  // Update withdrawal back to pending (NOT rejected - admin must review)
  const { error: wrUpdateError } = await supabase
    .from('withdrawal_requests')
    .update({
      status: 'pending', // Back to queue for admin review
      rejection_reason: `CPAY API Failure: ${failureReason}`,
      api_response: {
        ...withdrawal.api_response,
        status: 'failed',
        failure_reason: failureReason,
        webhook_received_at: failedAt,
        cpay_status: webhookData.systemStatus || webhookData.chargeStatus,
        webhook_ip: clientIP,
        requires_admin_review: true
      }
    })
    .eq('id', withdrawal.id)
    .eq('status', 'processing');
  
  if (wrUpdateError) {
    console.error('[CPAY-WEBHOOK] ❌ Failed to update withdrawal_requests:', wrUpdateError);
    throw new Error('Failed to update withdrawal failure status');
  }
  
  // DO NOT UPDATE TRANSACTION - Keep as pending so admin sees it in queue
  // DO NOT REFUND - Admin must manually reject to trigger refund
  
  console.log(
    `[CPAY-WEBHOOK] ⚠️ WITHDRAWAL FAILED (returned to pending): ` +
    `User ${withdrawal.profiles.username}, Amount: $${withdrawal.amount}, ` +
    `Reason: ${failureReason}`
  );
}

// ============================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Get client IP for rate limiting
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                   req.headers.get('x-real-ip') || 
                   'unknown';

  // Check rate limit
  if (!checkRateLimit(clientIP)) {
    console.error(`Rate limit exceeded for IP: ${clientIP}`);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Too many requests. Please try again later.' 
      }),
      { 
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const cpayPrivateKey = Deno.env.get('CPAY_API_PRIVATE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawPayload = await req.json();
    
    console.log('[CPAY-WEBHOOK] 📥 Webhook received from IP:', clientIP);
    console.log('[CPAY-WEBHOOK] 📦 Raw payload:', JSON.stringify(rawPayload, null, 2));
    
    // PHASE 2: Comprehensive debug logging for all possible payment ID fields
    if (rawPayload) {
      console.log('[CPAY-WEBHOOK] 🔍 PHASE 2 - All possible ID fields:', {
        orderId: rawPayload.orderId,
        chargeId: rawPayload.chargeId,
        hash: rawPayload.hash,
        payment_id: rawPayload.payment_id,
        withdrawalId: rawPayload.withdrawalId,
        id: rawPayload.id,
        'data.id': rawPayload.data?.id,
        'data.withdrawalId': rawPayload.data?.withdrawalId,
        'data.orderId': rawPayload.data?.orderId
      });
    }

    // Known CPAY IPs for logging (not blocking)
    const knownCPAYIPs = ['195.201.62.123'];
    if (!knownCPAYIPs.includes(clientIP)) {
      console.warn(`[CPAY-WEBHOOK] ⚠️ Webhook from unknown IP: ${clientIP} (not blocking)`);
    }

    let webhookData: any;

    // Check if payload is encrypted (contains 'data' field with base64)
    if (rawPayload.data && typeof rawPayload.data === 'string' && rawPayload.data.startsWith('U2FsdGVk')) {
      console.log('[CPAY-WEBHOOK] 🔐 Encrypted payload detected, using JWT-based two-stage decryption...');
      
      // Import crypto-js for AES decryption (Deno-compatible)
      const CryptoJSModule = await import('https://esm.sh/crypto-js@4.2.0');
      const CryptoJS = CryptoJSModule.default;
      
      try {
        // STEP 1: Extract and decode JWT from Authorization header
        const authHeader = req.headers.get('authorization') || '';
        if (!authHeader.startsWith('Bearer ')) {
          throw new Error('Missing or invalid Authorization header - JWT Bearer token required for encrypted webhooks');
        }
        
        // Extract token (up to first comma if present)
        let jwtToken = authHeader.slice('Bearer '.length).trim();
        const commaIndex = jwtToken.indexOf(',');
        if (commaIndex !== -1) {
          jwtToken = jwtToken.substring(0, commaIndex);
        }
        
        // Decode JWT (simple base64url decode, no verification needed per CPAY docs)
        const jwtParts = jwtToken.split('.');
        if (jwtParts.length !== 3) {
          throw new Error('Invalid JWT structure');
        }
        
        // Base64url decode payload
        const base64Payload = jwtParts[1].replace(/-/g, '+').replace(/_/g, '/');
        const paddedPayload = base64Payload.padEnd(base64Payload.length + (4 - base64Payload.length % 4) % 4, '=');
        const decodedPayload = atob(paddedPayload);
        const jwtPayload = JSON.parse(decodedPayload);
        
        console.log('[CPAY-WEBHOOK] ✓ JWT decoded successfully');
        
        // STEP 2: Extract required fields from JWT
        const walletId = jwtPayload.id;
        const encryptedSalt = jwtPayload.salt;
        const exp = jwtPayload.exp;
        
        if (!walletId || !encryptedSalt || !exp) {
          throw new Error('JWT missing required fields: id, salt, or exp');
        }
        
        // STEP 3: Validate JWT expiration
        const currentTime = Math.floor(Date.now() / 1000);
        if (exp < currentTime) {
          throw new Error('JWT token has expired');
        }
        
        console.log('[CPAY-WEBHOOK] ✓ JWT validation passed');
        
        // STEP 4: Decrypt the encryptedSalt using walletId as password to get finalSalt
        const decryptedSaltBytes = CryptoJS.AES.decrypt(encryptedSalt, walletId);
        const finalSalt = decryptedSaltBytes.toString(CryptoJS.enc.Utf8);
        
        if (!finalSalt) {
          throw new Error('Failed to derive finalSalt from encrypted salt');
        }
        
        console.log('[CPAY-WEBHOOK] ✓ finalSalt derived successfully');
        
        // STEP 5: Decrypt the body.data using finalSalt as password
        const encryptedData = rawPayload.data;
        const decryptedBodyBytes = CryptoJS.AES.decrypt(encryptedData, finalSalt);
        const decryptedBodyText = decryptedBodyBytes.toString(CryptoJS.enc.Utf8);
        
        if (!decryptedBodyText) {
          throw new Error('Decryption resulted in empty string - finalSalt may be incorrect');
        }
        
        // STEP 6: Parse decrypted JSON
        webhookData = JSON.parse(decryptedBodyText);
        console.log('[CPAY-WEBHOOK] ✅ Two-stage decryption successful');
        
      } catch (decryptError) {
        console.error('[CPAY-WEBHOOK] ❌ Decryption failed:', decryptError);
        const errorMsg = decryptError instanceof Error ? decryptError.message : 'Unknown decryption error';
        throw new Error(`Failed to decrypt webhook: ${errorMsg}`);
      }
    } else if (rawPayload.signature) {
      console.log('[CPAY-WEBHOOK] 📝 Signature-based payload detected, verifying...');
      
      // Verify webhook signature (plaintext webhook)
      const { signature, ...dataToVerify } = rawPayload;
      const verifyString = Object.keys(dataToVerify)
        .sort()
        .map(key => `${key}=${dataToVerify[key]}`)
        .join('&') + cpayPrivateKey;

      const encoder = new TextEncoder();
      const data = encoder.encode(verifyString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      if (signature !== expectedSignature) {
        console.error('[CPAY-WEBHOOK] ❌ Invalid webhook signature');
        throw new Error('Invalid signature');
      }
      
      webhookData = dataToVerify;
      console.log('[CPAY-WEBHOOK] ✅ Signature verified');
    } else {
      console.error('[CPAY-WEBHOOK] ❌ Unknown payload format - no data field or signature');
      throw new Error('Unknown webhook payload format');
    }

    // PHASE 2: Enhanced payment ID extraction - check 8 possible fields
    const trackingId = webhookData.outsideOrderId || webhookData.clickId || webhookData.order_id;
    const payment_id = 
      webhookData.orderId ||           // Deposit field
      webhookData.chargeId ||          // Deposit field  
      webhookData.hash ||              // Transaction hash
      webhookData.payment_id ||        // Generic field
      webhookData.withdrawalId ||      // 🆕 Withdrawal-specific field
      webhookData.id ||                // 🆕 Top-level ID
      webhookData.data?.id ||          // 🆕 Nested ID (common in CPAY responses)
      webhookData.data?.withdrawalId;  // 🆕 Nested withdrawal ID
    
    console.log('[CPAY-WEBHOOK] 🆔 PHASE 2 - Extracted payment_id:', payment_id);
    
    const webhookAmount = parseFloat(webhookData.amountUSD || webhookData.amount || '0');
    const currency = webhookData.currency || 'USD';
    
    // Determine payment status
    let status: string;
    if (webhookData.systemStatus === 'Done' || 
        webhookData.chargeStatus === 'Done' || 
        webhookData.status === true ||
        webhookData.systemStatus === 'Success') {
      status = 'completed';
    } else if (webhookData.systemStatus === 'Cancelled' || 
               webhookData.systemStatus === 'Failed' || 
               webhookData.systemStatus === 'Expired' ||
               webhookData.chargeStatus === 'Failed' ||
               webhookData.chargeStatus === 'Cancelled' ||
               webhookData.status === false) {
      status = 'failed';
    } else {
      status = 'pending';
    }
    
    console.log(`[CPAY-WEBHOOK] 🔍 Normalized data: trackingId=${trackingId}, payment_id=${payment_id}, status=${status}, amount=${webhookAmount} ${currency}`);

    if (!trackingId) {
      console.error('[CPAY-WEBHOOK] ❌ No trackingId found in webhook payload');
      throw new Error('Missing trackingId (outsideOrderId/clickId/order_id) in webhook');
    }

    // Find transaction by matching order_id stored in metadata (sent as clickId to CPAY)
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*, profiles!inner(id, deposit_wallet_balance, username, email)')
      .eq('payment_gateway', 'cpay')
      .eq('type', 'deposit')
      .contains('metadata', { order_id: trackingId })
      .single();

    if (txError || !transaction) {
      console.log(`[CPAY-WEBHOOK] ℹ️ No deposit found for clickId=${trackingId}, checking withdrawals...`);
      
      // === WITHDRAWAL LOOKUP FALLBACK ===
      // PHASE 3: Idempotent withdrawal lookup - check by CPAY ID regardless of status
      if (payment_id) {
        console.log('[CPAY-WEBHOOK] 🔍 PHASE 3 - Searching for withdrawal with cpay_withdrawal_id:', payment_id);
        
        // Search withdrawal_requests by cpay_withdrawal_id in api_response (no status filter)
        const { data: withdrawalRequest, error: wrError } = await supabase
          .from('withdrawal_requests')
          .select('*, profiles!inner(id, earnings_wallet_balance, username, email)')
          .eq('payment_provider', 'cpay')
          .contains('api_response', { cpay_withdrawal_id: payment_id })
          .maybeSingle();
        
        if (wrError) {
          console.error('[CPAY-WEBHOOK] ❌ Error querying withdrawals:', wrError);
        }
        
        if (withdrawalRequest) {
          console.log('[CPAY-WEBHOOK] ✅ Found withdrawal request:', withdrawalRequest.id, 'Status:', withdrawalRequest.status);
          
          // PHASE 3: Make webhook non-authoritative - no-op if already in terminal state
          if (withdrawalRequest.status === 'completed') {
            console.log('[CPAY-WEBHOOK] ✓ PHASE 3 - Withdrawal already completed, ignoring webhook (idempotent)');
            return new Response(
              JSON.stringify({ 
                success: true, 
                message: 'Withdrawal already completed - webhook ignored (idempotent)',
                withdrawal_id: withdrawalRequest.id,
                current_status: 'completed'
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          if (withdrawalRequest.status === 'rejected') {
            console.log('[CPAY-WEBHOOK] ✓ PHASE 3 - Withdrawal already rejected, ignoring webhook (idempotent)');
            return new Response(
              JSON.stringify({ 
                success: true, 
                message: 'Withdrawal already rejected - webhook ignored (idempotent)',
                withdrawal_id: withdrawalRequest.id,
                current_status: 'rejected'
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          if (withdrawalRequest.status === 'pending') {
            console.log('[CPAY-WEBHOOK] ✓ PHASE 3 - Withdrawal in pending state, ignoring webhook (API completion is canonical)');
            return new Response(
              JSON.stringify({ 
                success: true, 
                message: 'Withdrawal pending - webhook ignored (API completion is canonical)',
                withdrawal_id: withdrawalRequest.id,
                current_status: 'pending'
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          // Only process if still in legacy "processing" state (shouldn't happen after Phase 1)
          console.log('[CPAY-WEBHOOK] ⚠️ PHASE 3 - Found legacy processing withdrawal, handling status:', status);
          
          // Handle based on webhook status
          if (status === 'completed') {
            await handleWithdrawalCompletion(supabase, withdrawalRequest, payment_id, webhookData, clientIP);
          } else if (status === 'failed') {
            await handleWithdrawalFailure(supabase, withdrawalRequest, payment_id, webhookData, clientIP);
          }
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Legacy withdrawal status updated via webhook',
              withdrawal_id: withdrawalRequest.id,
              new_status: status
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          console.log('[CPAY-WEBHOOK] ℹ️ No processing withdrawal found for payment_id:', payment_id);
        }
      }
      // === END WITHDRAWAL LOOKUP ===
      
      console.error(`[CPAY-WEBHOOK] ❌ No matching transaction or withdrawal found for clickId=${trackingId}, payment_id=${payment_id}`, txError);
      
      // Log all pending CPAY transactions for debugging
      const { data: pendingTxs } = await supabase
        .from('transactions')
        .select('id, metadata, created_at')
        .eq('payment_gateway', 'cpay')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10);
      
      console.log('[CPAY-WEBHOOK] 📋 Recent pending CPAY transactions:', JSON.stringify(pendingTxs, null, 2));
      throw new Error('Transaction/Withdrawal not found - clickId/order_id does not match any pending deposit or processing withdrawal');
    }

    console.log(`[CPAY-WEBHOOK] ✓ Transaction found: ${transaction.id}, User: ${transaction.profiles.username} (${transaction.profiles.email})`);
    
    // ============= IDEMPOTENCY CHECK =============
    // Prevent processing the same webhook twice (duplicate credits)
    if (transaction.status === 'completed') {
      console.log(
        `[CPAY-WEBHOOK] ⚠️ IDEMPOTENCY: Transaction ${transaction.id} already completed. ` +
        `Webhook for clickId=${trackingId}, payment_id=${payment_id} ignored to prevent duplicate credit.`
      );
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Webhook already processed - transaction already completed',
          transaction_id: transaction.id 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // ============================================
    
    // ============= SECONDARY DUPLICATE DETECTION (DEFENSE IN DEPTH) =============
    // Check if we already have a COMPLETED transaction for this tracking_id
    // This protects against race conditions where multiple webhooks arrive simultaneously
    console.log(`[CPAY-WEBHOOK] 🔍 Checking for existing completed transaction with tracking_id=${trackingId}...`);
    
    const { data: existingCompletedTx, error: existingError } = await supabase
      .from('transactions')
      .select('id, amount, created_at, gateway_transaction_id, user_id')
      .eq('type', 'deposit')
      .eq('status', 'completed')
      .contains('metadata', { tracking_id: trackingId })
      .maybeSingle();

    if (existingError) {
      console.error('[CPAY-WEBHOOK] ❌ Error checking for existing completed transaction:', existingError);
      // Don't throw - continue processing, atomic function will handle duplicates
    }

    if (existingCompletedTx) {
      console.log(
        `[CPAY-WEBHOOK] ⚠️ DUPLICATE WEBHOOK DETECTED: ` +
        `tracking_id=${trackingId} already processed in transaction ${existingCompletedTx.id}. ` +
        `Previous payment_id=${existingCompletedTx.gateway_transaction_id}, ` +
        `Current payment_id=${payment_id}. ` +
        `User: ${existingCompletedTx.user_id}. ` +
        `Ignoring duplicate webhook to prevent double-credit.`
      );
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Duplicate webhook ignored - transaction already completed with this tracking_id',
          transaction_id: existingCompletedTx.id,
          tracking_id: trackingId,
          previous_payment_id: existingCompletedTx.gateway_transaction_id,
          current_payment_id: payment_id,
          amount: existingCompletedTx.amount,
          completed_at: existingCompletedTx.created_at
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[CPAY-WEBHOOK] ✓ No existing completed transaction found for tracking_id=${trackingId}. Proceeding with processing.`);
    // ============================================================================
    
    // Extract requested amount from transaction metadata
    const requestedAmount = transaction.metadata?.requested_amount || transaction.amount;
    const actualAmount = webhookAmount; // Already parsed as number during normalization
    
    // Check for amount discrepancy
    if (Math.abs(actualAmount - requestedAmount) > 0.01) {
      console.warn(
        `[CPAY-WEBHOOK] ⚠️ AMOUNT DISCREPANCY: ` +
        `User requested $${requestedAmount}, but paid $${actualAmount}. ` +
        `Crediting actual amount: $${actualAmount}`
      );
    } else {
      console.log(`[CPAY-WEBHOOK] ✓ Amount matches: Requested=$${requestedAmount}, Paid=$${actualAmount}`);
    }

    // Handle payment status
    if (status === 'completed') {
      // Credit user with ACTUAL amount paid using atomic function V2 (race-condition safe + tracking_id based idempotency)
      console.log(
        `[CPAY-WEBHOOK] 💰 Calling atomic deposit function V2 for user ${transaction.profiles.id}: ` +
        `Current balance: ${transaction.profiles.deposit_wallet_balance}, Amount to credit: ${actualAmount}, ` +
        `tracking_id: ${trackingId}, payment_id: ${payment_id}`
      );
      
      const { data: atomicResult, error: atomicError } = await supabase.rpc('credit_deposit_atomic_v2', {
        p_user_id: transaction.profiles.id,
        p_amount: actualAmount,
        p_tracking_id: trackingId, // CRITICAL: Use tracking_id (original order ID like DEP-xxx) for idempotency
        p_payment_id: payment_id, // CPAY's payment_id (can be different per webhook for same order)
        p_payment_method: 'cpay',
        p_metadata: {
          tracking_id: trackingId, // Store in metadata for idempotency check
          webhook_received_at: new Date().toISOString(),
          cpay_status: status,
          cpay_payment_id: payment_id,
          cpay_system_status: webhookData.systemStatus || webhookData.chargeStatus,
          cpay_hash: webhookData.hash || webhookData.incomingTxHash,
          requested_amount: requestedAmount,
          actual_amount_paid: actualAmount,
          amount_discrepancy: actualAmount - requestedAmount,
          webhook_received_from_ip: clientIP,
          original_transaction_id: transaction.id
        }
      });

      if (atomicError) {
        console.error('[CPAY-WEBHOOK] ❌ Atomic deposit function error:', atomicError);
        throw new Error('Failed to process deposit atomically: ' + atomicError.message);
      }

      // Check if atomic function detected duplicate or failed
      if (!atomicResult.success) {
        if (atomicResult.error === 'duplicate_transaction') {
          console.log(
            `[CPAY-WEBHOOK] ⚠️ DUPLICATE PREVENTED by atomic function V2: ` +
            `tracking_id=${atomicResult.tracking_id} already processed in tx=${atomicResult.transaction_id}. ` +
            `Current payment_id=${atomicResult.duplicate_payment_id} ignored to prevent double-credit.`
          );
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Duplicate webhook prevented - transaction already processed',
              transaction_id: atomicResult.transaction_id,
              tracking_id: atomicResult.tracking_id,
              duplicate_payment_id: atomicResult.duplicate_payment_id
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.error('[CPAY-WEBHOOK] ❌ Atomic deposit failed:', atomicResult);
        throw new Error(atomicResult.message || 'Atomic deposit processing failed');
      }

      console.log('[CPAY-WEBHOOK] ✅ Atomic deposit V2 successful:', {
        transactionId: atomicResult.transaction_id,
        trackingId: atomicResult.tracking_id,
        paymentId: atomicResult.payment_id,
        oldBalance: atomicResult.old_balance,
        newBalance: atomicResult.new_balance,
        amountCredited: atomicResult.amount_credited,
        commissionProcessed: atomicResult.commission_processed,
        commissionAmount: atomicResult.commission_amount,
        commissionTransactionId: atomicResult.commission_transaction_id,
        referralEarningId: atomicResult.referral_earning_id
      });

      // Log commission processing result
      if (atomicResult.commission_processed) {
        console.log(
          `[CPAY-WEBHOOK] 💰 COMMISSION PROCESSED: Referrer earned $${atomicResult.commission_amount} ` +
          `from deposit by ${transaction.profiles.username}`
        );
      } else {
        console.log('[CPAY-WEBHOOK] ℹ️ No commission processed (user has no active referrer or commission rate is 0)');
      }

      // Update the original pending transaction to mark it as completed
      const { error: txUpdateError } = await supabase
        .from('transactions')
        .update({
          status: 'completed',
          amount: actualAmount, // Update to actual amount paid
          new_balance: atomicResult.new_balance,
          gateway_transaction_id: payment_id,
          metadata: {
            ...transaction.metadata,
            atomic_transaction_id: atomicResult.transaction_id,
            webhook_received_at: new Date().toISOString(),
            cpay_status: status,
            cpay_payment_id: payment_id,
            cpay_system_status: webhookData.systemStatus || webhookData.chargeStatus,
            cpay_hash: webhookData.hash || webhookData.incomingTxHash,
            requested_amount: requestedAmount,
            actual_amount_paid: actualAmount,
            amount_discrepancy: actualAmount - requestedAmount,
            webhook_received_from_ip: clientIP,
            webhook_payload: webhookData, // Store full decrypted webhook for debugging
            raw_webhook_payload: rawPayload // Store original encrypted payload
          },
        })
        .eq('id', transaction.id);

      if (txUpdateError) {
        console.warn('[CPAY-WEBHOOK] ⚠️ Failed to update original pending transaction (deposit still credited via atomic function):', txUpdateError);
        // Don't throw - the deposit was credited successfully, this is just metadata update
      }
      
      const newBalance = atomicResult.new_balance; // Use balance from atomic result

      console.log(
        `[CPAY-WEBHOOK] ✅ DEPOSIT COMPLETED: ` +
        `User ${transaction.profiles.username} (${transaction.profiles.id}) ` +
        `credited ${actualAmount} ${currency}. New balance: ${newBalance}` +
        (atomicResult.commission_processed ? ` | Commission: $${atomicResult.commission_amount} paid to referrer` : '')
      );

      // Send success notification
      try {
        await supabase.functions.invoke('send-cpay-notification', {
          body: {
            user_id: transaction.profiles.id,
            type: 'deposit_success',
            data: {
              amount: actualAmount,
              currency,
              transaction_id: payment_id,
              requested_amount: requestedAmount,
            },
          },
        });
      } catch (notifError) {
        console.warn('[CPAY-WEBHOOK] ⚠️ Failed to send notification:', notifError);
        // Don't throw - notification failure shouldn't fail the webhook
      }

    } else if (status === 'failed') {
      // Update transaction as failed
      await supabase
        .from('transactions')
        .update({
          status: 'failed',
          gateway_transaction_id: payment_id,
          metadata: {
            ...transaction.metadata,
            webhook_received_at: new Date().toISOString(),
            cpay_status: status,
            cpay_system_status: webhookData.systemStatus || webhookData.chargeStatus,
            webhook_received_from_ip: clientIP,
            webhook_payload: webhookData,
            raw_webhook_payload: rawPayload,
          },
        })
        .eq('id', transaction.id);

      console.log(
        `[CPAY-WEBHOOK] ❌ DEPOSIT FAILED: ` +
        `User ${transaction.profiles.username} (${transaction.profiles.id}), Status: ${status}`
      );

      // Send failure notification
      try {
        await supabase.functions.invoke('send-cpay-notification', {
          body: {
            user_id: transaction.profiles.id,
            type: 'deposit_failed',
            data: {
              amount: actualAmount,
              currency,
              transaction_id: payment_id,
            },
          },
        });
      } catch (notifError) {
        console.warn('[CPAY-WEBHOOK] ⚠️ Failed to send failure notification:', notifError);
      }
    } else {
      console.warn(`[CPAY-WEBHOOK] ⚠️ Unknown payment status: ${status}. Transaction ID: ${transaction.id}`);
    }

    console.log('[CPAY-WEBHOOK] ✅ Webhook processed successfully');
    
    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processed successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CPAY-WEBHOOK] ❌ ERROR:', error);
    console.error('[CPAY-WEBHOOK] 📍 Error stack:', error instanceof Error ? error.stack : 'N/A');
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
