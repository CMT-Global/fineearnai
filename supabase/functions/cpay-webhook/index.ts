import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTemplateEmail } from "../_shared/email-sender.ts";
import { getSystemSecrets } from "../_shared/secrets.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// Rate limiter: Track requests per IP with sliding window
const rateLimiter = new Map();
const RATE_LIMIT = 100; // Max requests per minute per IP
const RATE_WINDOW = 60 * 1000; // 1 minute in milliseconds
// Cleanup old entries every 5 minutes
setInterval(()=>{
  const now = Date.now();
  for (const [ip, data] of rateLimiter.entries()){
    if (now > data.resetTime) {
      rateLimiter.delete(ip);
    }
  }
}, 5 * 60 * 1000);
function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimiter.get(ip);
  if (!record || now > record.resetTime) {
    // New window or expired window
    rateLimiter.set(ip, {
      count: 1,
      resetTime: now + RATE_WINDOW
    });
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
async function handleWithdrawalCompletion(supabase, withdrawal, cpayId, webhookData, clientIP) {
  console.log(`[CPAY-WEBHOOK] 💚 Processing withdrawal completion: ${withdrawal.id}`);
  const txHash = webhookData.hash || webhookData.transactionHash || webhookData.txHash || null;
  const completedAt = new Date().toISOString();
  // 1. Update withdrawal_requests to completed
  const { error: wrUpdateError } = await supabase.from('withdrawal_requests').update({
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
  }).eq('id', withdrawal.id).eq('status', 'processing'); // Safety check
  if (wrUpdateError) {
    console.error('[CPAY-WEBHOOK] ❌ Failed to update withdrawal_requests:', wrUpdateError);
    throw new Error('Failed to update withdrawal status');
  }
  // 2. Update corresponding transaction to completed
  const { error: txUpdateError } = await supabase.from('transactions').update({
    status: 'completed',
    gateway_transaction_id: cpayId,
    metadata: {
      completed_via_webhook: true,
      webhook_received_at: completedAt,
      transaction_hash: txHash,
      withdrawal_request_id: withdrawal.id
    }
  }).eq('type', 'withdrawal').eq('user_id', withdrawal.user_id).contains('metadata', {
    withdrawal_request_id: withdrawal.id
  }).eq('status', 'pending');
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
  console.log(`[CPAY-WEBHOOK] ✅ WITHDRAWAL COMPLETED: ` + `User ${withdrawal.profiles.username}, Amount: $${withdrawal.amount}, ` + `TxHash: ${txHash || 'N/A'}`);
}
async function handleWithdrawalFailure(supabase, withdrawal, cpayId, webhookData, clientIP) {
  console.log(`[CPAY-WEBHOOK] ⚠️ Processing withdrawal failure: ${withdrawal.id}`);
  const failureReason = webhookData.failureReason || webhookData.error || 'CPAY withdrawal failed - status: ' + (webhookData.systemStatus || webhookData.chargeStatus);
  const failedAt = new Date().toISOString();
  // Update withdrawal back to pending (NOT rejected - admin must review)
  const { error: wrUpdateError } = await supabase.from('withdrawal_requests').update({
    status: 'pending',
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
  }).eq('id', withdrawal.id).eq('status', 'processing');
  if (wrUpdateError) {
    console.error('[CPAY-WEBHOOK] ❌ Failed to update withdrawal_requests:', wrUpdateError);
    throw new Error('Failed to update withdrawal failure status');
  }
  // DO NOT UPDATE TRANSACTION - Keep as pending so admin sees it in queue
  // DO NOT REFUND - Admin must manually reject to trigger refund
  console.log(`[CPAY-WEBHOOK] ⚠️ WITHDRAWAL FAILED (returned to pending): ` + `User ${withdrawal.profiles.username}, Amount: $${withdrawal.amount}, ` + `Reason: ${failureReason}`);
}
// ============================================
serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  // Get client IP for rate limiting
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  // Check rate limit
  if (!checkRateLimit(clientIP)) {
    console.error(`Rate limit exceeded for IP: ${clientIP}`);
    return new Response(JSON.stringify({
      success: false,
      error: 'Too many requests. Please try again later.'
    }), {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const secrets = await getSystemSecrets(supabase);
    const cpayPrivateKey = secrets.cpay.privateKey!;

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
    const knownCPAYIPs = [
      '195.201.62.123'
    ];
    if (!knownCPAYIPs.includes(clientIP)) {
      console.warn(`[CPAY-WEBHOOK] ⚠️ Webhook from unknown IP: ${clientIP} (not blocking)`);
    }
    let webhookData;
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
      const verifyString = Object.keys(dataToVerify).sort().map((key)=>`${key}=${dataToVerify[key]}`).join('&') + cpayPrivateKey;
      const encoder = new TextEncoder();
      const data = encoder.encode(verifyString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const expectedSignature = hashArray.map((b)=>b.toString(16).padStart(2, '0')).join('');
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
    const payment_id = webhookData.orderId || // Deposit field
    webhookData.chargeId || // Deposit field  
    webhookData.hash || // Transaction hash
    webhookData.payment_id || // Generic field
    webhookData.withdrawalId || // 🆕 Withdrawal-specific field
    webhookData.id || // 🆕 Top-level ID
    webhookData.data?.id || // 🆕 Nested ID (common in CPAY responses)
    webhookData.data?.withdrawalId; // 🆕 Nested withdrawal ID
    console.log('[CPAY-WEBHOOK] 🆔 PHASE 2 - Extracted payment_id:', payment_id);
    const webhookAmount = parseFloat(webhookData.amountUSD || webhookData.amount || '0');
    const currency = webhookData.currency || 'USD';
    // Determine payment status
    let status;
    if (webhookData.systemStatus === 'Done' || webhookData.chargeStatus === 'Done' || webhookData.status === true || webhookData.systemStatus === 'Success') {
      status = 'completed';
    } else if (webhookData.systemStatus === 'Cancelled' || webhookData.systemStatus === 'Failed' || webhookData.systemStatus === 'Expired' || webhookData.chargeStatus === 'Failed' || webhookData.chargeStatus === 'Cancelled' || webhookData.status === false) {
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
    const { data: transaction, error: txError } = await supabase.from('transactions').select('*, profiles!inner(id, deposit_wallet_balance, username, email)').eq('payment_gateway', 'cpay').eq('type', 'deposit').contains('metadata', {
      order_id: trackingId
    }).single();
    if (txError || !transaction) {
      console.log(`[CPAY-WEBHOOK] ℹ️ No deposit found for clickId=${trackingId}, checking withdrawals...`);
      // === WITHDRAWAL LOOKUP FALLBACK ===
      // PHASE 3: Idempotent withdrawal lookup - check by CPAY ID regardless of status
      if (payment_id) {
        console.log('[CPAY-WEBHOOK] 🔍 PHASE 3 - Searching for withdrawal with cpay_withdrawal_id:', payment_id);
        // Search withdrawal_requests by cpay_withdrawal_id in api_response (no status filter)
        const { data: withdrawalRequest, error: wrError } = await supabase.from('withdrawal_requests').select('*, profiles!inner(id, earnings_wallet_balance, username, email)').eq('payment_provider', 'cpay').contains('api_response', {
          cpay_withdrawal_id: payment_id
        }).maybeSingle();
        if (wrError) {
          console.error('[CPAY-WEBHOOK] ❌ Error querying withdrawals:', wrError);
        }
        if (withdrawalRequest) {
          console.log('[CPAY-WEBHOOK] ✅ Found withdrawal request:', withdrawalRequest.id, 'Status:', withdrawalRequest.status);
          // PHASE 3: Make webhook non-authoritative - no-op if already in terminal state
          if (withdrawalRequest.status === 'completed') {
            console.log('[CPAY-WEBHOOK] ✓ PHASE 3 - Withdrawal already completed, ignoring webhook (idempotent)');
            return new Response(JSON.stringify({
              success: true,
              message: 'Withdrawal already completed - webhook ignored (idempotent)',
              withdrawal_id: withdrawalRequest.id,
              current_status: 'completed'
            }), {
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          if (withdrawalRequest.status === 'rejected') {
            console.log('[CPAY-WEBHOOK] ✓ PHASE 3 - Withdrawal already rejected, ignoring webhook (idempotent)');
            return new Response(JSON.stringify({
              success: true,
              message: 'Withdrawal already rejected - webhook ignored (idempotent)',
              withdrawal_id: withdrawalRequest.id,
              current_status: 'rejected'
            }), {
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          if (withdrawalRequest.status === 'pending') {
            console.log('[CPAY-WEBHOOK] ✓ PHASE 3 - Withdrawal in pending state, ignoring webhook (API completion is canonical)');
            return new Response(JSON.stringify({
              success: true,
              message: 'Withdrawal pending - webhook ignored (API completion is canonical)',
              withdrawal_id: withdrawalRequest.id,
              current_status: 'pending'
            }), {
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Only process if still in legacy "processing" state (shouldn't happen after Phase 1)
          console.log('[CPAY-WEBHOOK] ⚠️ PHASE 3 - Found legacy processing withdrawal, handling status:', status);
          // Handle based on webhook status
          if (status === 'completed') {
            await handleWithdrawalCompletion(supabase, withdrawalRequest, payment_id, webhookData, clientIP);
          } else if (status === 'failed') {
            await handleWithdrawalFailure(supabase, withdrawalRequest, payment_id, webhookData, clientIP);
          }
          return new Response(JSON.stringify({
            success: true,
            message: 'Legacy withdrawal status updated via webhook',
            withdrawal_id: withdrawalRequest.id,
            new_status: status
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } else {
          console.log('[CPAY-WEBHOOK] ℹ️ No processing withdrawal found for payment_id:', payment_id);
        }
      }
      // === END WITHDRAWAL LOOKUP ===
      console.error(`[CPAY-WEBHOOK] ❌ No matching transaction or withdrawal found for clickId=${trackingId}, payment_id=${payment_id}`, txError);
      // Log all pending CPAY transactions for debugging
      const { data: pendingTxs } = await supabase.from('transactions').select('id, metadata, created_at').eq('payment_gateway', 'cpay').eq('status', 'pending').order('created_at', {
        ascending: false
      }).limit(10);
      console.log('[CPAY-WEBHOOK] 📋 Recent pending CPAY transactions:', JSON.stringify(pendingTxs, null, 2));
      throw new Error('Transaction/Withdrawal not found - clickId/order_id does not match any pending deposit or processing withdrawal');
    }
    console.log(`[CPAY-WEBHOOK] ✓ Transaction found: ${transaction.id}, User: ${transaction.profiles.username} (${transaction.profiles.email})`);
    console.log(`[CPAY-WEBHOOK] 🔄 Calling credit_deposit_simple_v3 for tracking_id=${trackingId}, payment_id=${payment_id}. Duplicate detection will be handled by atomic function.`);
    // Extract requested amount from transaction metadata
    const requestedAmount = transaction.metadata?.requested_amount || transaction.amount;
    const actualAmount = webhookAmount; // Already parsed as number during normalization
    // Check for amount discrepancy
    if (Math.abs(actualAmount - requestedAmount) > 0.01) {
      console.warn(`[CPAY-WEBHOOK] ⚠️ AMOUNT DISCREPANCY: ` + `User requested $${requestedAmount}, but paid $${actualAmount}. ` + `Crediting actual amount: $${actualAmount}`);
    } else {
      console.log(`[CPAY-WEBHOOK] ✓ Amount matches: Requested=$${requestedAmount}, Paid=$${actualAmount}`);
    }
    // Handle payment status
    if (status === 'completed') {
      // ============================================================================
      // PHASE 4: TWO-STEP FLOW (Deposit First, Then Commission)
      // ============================================================================
      // Step 1: Process deposit (MUST succeed - user gets credited)
      // Step 2: Process commission (CAN fail gracefully - logged but non-critical)
      // This separation ensures users always receive deposits even if commission fails.
      // ============================================================================
      console.log(`[CPAY-WEBHOOK-V3] 💰 Starting two-step deposit flow for user ${transaction.profiles.id}: ` + `Current balance: ${transaction.profiles.deposit_wallet_balance}, Amount to credit: ${actualAmount}, ` + `tracking_id: ${trackingId}, payment_id: ${payment_id}`);
      // ============================================================================
      // STEP 1: Process Deposit (CRITICAL - Must Succeed)
      // ============================================================================
      console.log(`[DEPOSIT-V3] Step 1: Processing deposit ONLY...`);
      const { data: depositResult, error: depositError } = await supabase.rpc('credit_deposit_simple_v3', {
        p_user_id: transaction.profiles.id,
        p_amount: actualAmount,
        p_tracking_id: trackingId,
        p_payment_id: payment_id,
        p_payment_method: 'cpay',
        p_metadata: {
          tracking_id: trackingId,
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
      if (depositError || !depositResult?.success) {
        console.error('[DEPOSIT-V3] ❌ Deposit processing failed:', depositError || depositResult);
        throw new Error('Failed to process deposit: ' + (depositError?.message || depositResult?.error));
      }
      // Check for duplicate detection
      if (depositResult.error === 'duplicate_transaction') {
        console.log(`[DEPOSIT-V3] ⚠️ DUPLICATE PREVENTED: ` + `tracking_id=${trackingId} already processed in tx=${depositResult.existing_transaction_id}`);
        return new Response(JSON.stringify({
          success: true,
          message: 'Duplicate webhook prevented - transaction already processed',
          transaction_id: depositResult.existing_transaction_id,
          tracking_id: trackingId
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      console.log('[DEPOSIT-V3] ✅ Deposit successful:', {
        transactionId: depositResult.transaction_id,
        oldBalance: depositResult.old_balance,
        newBalance: depositResult.new_balance,
        amountCredited: depositResult.amount_credited
      });
      // ============================================================================
      // STEP 2: Process Commission (NON-CRITICAL - Can Fail Gracefully)
      // ============================================================================
      console.log(`[COMMISSION-V1] Step 2: Processing commission separately...`);
      // Simple retry for commission only (2 retries max)
      const MAX_COMMISSION_RETRIES = 2;
      let commissionResult = null;
      for(let attempt = 0; attempt <= MAX_COMMISSION_RETRIES; attempt++){
        console.log(`[COMMISSION-V1] Attempt ${attempt + 1}/${MAX_COMMISSION_RETRIES + 1}`);
        const { data } = await supabase.rpc('process_deposit_commission_simple_v1', {
          p_deposit_transaction_id: depositResult.transaction_id,
          p_deposit_amount: actualAmount,
          p_depositor_id: transaction.profiles.id
        });
        commissionResult = data;
        if (data?.success) {
          if (attempt > 0) {
            console.log(`[COMMISSION-V1] ✅ Commission succeeded after ${attempt} retries`);
          }
          break; // Success, exit retry loop
        }
        if (attempt < MAX_COMMISSION_RETRIES) {
          const delayMs = 1000 * (attempt + 1); // 1s, 2s delay
          console.warn(`[COMMISSION-V1] ⚠️ Attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`, data);
          await new Promise((r)=>setTimeout(r, delayMs));
        }
      }
      // Log commission outcome
      if (commissionResult?.success) {
        if (commissionResult.commission_amount > 0) {
          console.log(`[COMMISSION-V1] ✅ Commission processed: $${commissionResult.commission_amount} ` + `to upline ${commissionResult.upline_username || commissionResult.upline_id}`);
        } else {
          console.log('[COMMISSION-V1] ℹ️ Commission skipped:', commissionResult.reason || 'No upline or zero rate');
        }
      } else {
        console.warn('[COMMISSION-V1] ⚠️ Commission failed (non-critical):', commissionResult?.error || 'Unknown error');
      }
      // ============================================================================
      // COMMISSION AUDIT LOGGING
      // ============================================================================
      const auditLogEntry = {
        deposit_transaction_id: depositResult.transaction_id,
        referrer_id: commissionResult?.upline_id || null,
        referred_id: transaction.profiles.id,
        commission_type: 'deposit',
        status: commissionResult?.success && commissionResult?.commission_amount > 0 ? 'success' : 'failed',
        commission_amount: commissionResult?.commission_amount || 0,
        error_details: commissionResult?.success ? null : {
          reason: commissionResult?.error || commissionResult?.reason || 'Commission processing failed',
          error_code: commissionResult?.error_code || 'UNKNOWN',
          tracking_id: trackingId,
          payment_id: payment_id,
          deposit_amount: actualAmount,
          username: transaction.profiles.username,
          timestamp: new Date().toISOString()
        }
      };
      const { error: auditLogError } = await supabase.from('commission_audit_log').insert(auditLogEntry);
      if (auditLogError) {
        console.warn('[COMMISSION-V1] ⚠️ Failed to insert audit log (non-critical):', auditLogError);
      } else {
        console.log('[COMMISSION-V1] ✓ Audit log created:', auditLogEntry.status);
      }
      // Store results for use below (replacing old atomicResult variable)
      const atomicResult = {
        ...depositResult,
        commission_processed: commissionResult?.success && commissionResult?.commission_amount > 0,
        commission_amount: commissionResult?.commission_amount || 0,
        commission_transaction_id: commissionResult?.commission_transaction_id || null,
        referral_earning_id: commissionResult?.referral_earning_id || null
      };
      // Update the original pending transaction to mark it as completed
      const { error: txUpdateError } = await supabase.from('transactions').update({
        status: 'completed',
        amount: actualAmount,
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
          webhook_payload: webhookData,
          raw_webhook_payload: rawPayload // Store original encrypted payload
        }
      }).eq('id', transaction.id);
      if (txUpdateError) {
        console.warn('[CPAY-WEBHOOK] ⚠️ Failed to update original pending transaction (deposit still credited via atomic function):', txUpdateError);
      // Don't throw - the deposit was credited successfully, this is just metadata update
      }
      const newBalance = atomicResult.new_balance; // Use balance from atomic result
      console.log(`[CPAY-WEBHOOK] ✅ DEPOSIT COMPLETED: ` + `User ${transaction.profiles.username} (${transaction.profiles.id}) ` + `credited ${actualAmount} ${currency}. New balance: ${newBalance}` + (atomicResult.commission_processed ? ` | Commission: $${atomicResult.commission_amount} paid to referrer` : ''));
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
              requested_amount: requestedAmount
            }
          }
        });
      } catch (notifError) {
        console.warn('[CPAY-WEBHOOK] ⚠️ Failed to send notification:', notifError);
      // Don't throw - notification failure shouldn't fail the webhook
      }
      // Send deposit confirmation email
      try {
        console.log('[CPAY-WEBHOOK] 📧 Sending deposit confirmation email to:', transaction.profiles.email);
        const emailResult = await sendTemplateEmail({
          templateType: 'deposit_confirmation',
          recipientEmail: transaction.profiles.email,
          recipientUserId: transaction.profiles.id,
          variables: {
            username: transaction.profiles.username,
            email: transaction.profiles.email,
            amount: actualAmount.toString(),
            currency: currency,
            transaction_id: atomicResult.transaction_id,
            new_balance: newBalance.toString(),
            payment_method: 'CPAY',
            payment_id: payment_id || 'N/A',
            tracking_id: trackingId || 'N/A',
            commission_earned: atomicResult.commission_processed ? atomicResult.commission_amount.toString() : '0',
            date: new Date().toLocaleString('en-US', {
              timeZone: 'UTC',
              dateStyle: 'full',
              timeStyle: 'long'
            })
          },
          supabaseClient: supabase
        });
        if (emailResult.success) {
          console.log('[CPAY-WEBHOOK] ✅ Deposit confirmation email sent successfully. Message ID:', emailResult.messageId);
        } else {
          console.warn('[CPAY-WEBHOOK] ⚠️ Deposit confirmation email failed:', emailResult.error);
        }
      } catch (emailError) {
        console.warn('[CPAY-WEBHOOK] ⚠️ Email sending failed (non-critical):', emailError);
      // Don't throw - email failure shouldn't fail the webhook
      }
    } else if (status === 'failed') {
      // Update transaction as failed
      await supabase.from('transactions').update({
        status: 'failed',
        gateway_transaction_id: payment_id,
        metadata: {
          ...transaction.metadata,
          webhook_received_at: new Date().toISOString(),
          cpay_status: status,
          cpay_system_status: webhookData.systemStatus || webhookData.chargeStatus,
          webhook_received_from_ip: clientIP,
          webhook_payload: webhookData,
          raw_webhook_payload: rawPayload
        }
      }).eq('id', transaction.id);
      console.log(`[CPAY-WEBHOOK] ❌ DEPOSIT FAILED: ` + `User ${transaction.profiles.username} (${transaction.profiles.id}), Status: ${status}`);
      // Send failure notification
      try {
        await supabase.functions.invoke('send-cpay-notification', {
          body: {
            user_id: transaction.profiles.id,
            type: 'deposit_failed',
            data: {
              amount: actualAmount,
              currency,
              transaction_id: payment_id
            }
          }
        });
      } catch (notifError) {
        console.warn('[CPAY-WEBHOOK] ⚠️ Failed to send failure notification:', notifError);
      }
    } else {
      console.warn(`[CPAY-WEBHOOK] ⚠️ Unknown payment status: ${status}. Transaction ID: ${transaction.id}`);
    }
    console.log('[CPAY-WEBHOOK] ✅ Webhook processed successfully');
    return new Response(JSON.stringify({
      success: true,
      message: 'Webhook processed successfully'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('[CPAY-WEBHOOK] ❌ ERROR:', error);
    console.error('[CPAY-WEBHOOK] 📍 Error stack:', error instanceof Error ? error.stack : 'N/A');
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
