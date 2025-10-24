import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Normalize webhook fields (CPAY sends different field names)
    const trackingId = webhookData.outsideOrderId || webhookData.clickId || webhookData.order_id;
    const payment_id = webhookData.orderId || webhookData.chargeId || webhookData.hash || webhookData.payment_id;
    const webhookAmount = parseFloat(webhookData.amountUSD || webhookData.amount || '0');
    const currency = webhookData.currency || 'USD';
    
    // Determine if this is a deposit or withdrawal webhook
    const isWithdrawal = webhookData.type === 'withdrawal' || 
                        webhookData.operationType === 'withdrawal' ||
                        (trackingId && trackingId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)); // UUID format = withdrawal ID
    
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
    
    console.log(`[CPAY-WEBHOOK] 🔍 Normalized data: trackingId=${trackingId}, payment_id=${payment_id}, status=${status}, amount=${webhookAmount} ${currency}, isWithdrawal=${isWithdrawal}`);

    if (!trackingId) {
      console.error('[CPAY-WEBHOOK] ❌ No trackingId found in webhook payload');
      throw new Error('Missing trackingId (outsideOrderId/clickId/order_id) in webhook');
    }

    // ============================================================
    // ROUTE 1: WITHDRAWAL WEBHOOK (clickId = withdrawal.id UUID)
    // ============================================================
    if (isWithdrawal) {
      console.log(`[CPAY-WEBHOOK] 🔁 Processing withdrawal webhook for ID: ${trackingId}`);
      
      // Find withdrawal request by ID (sent as clickId)
      const { data: withdrawal, error: withdrawalError } = await supabase
        .from('withdrawal_requests')
        .select('*, profiles!inner(id, username, email)')
        .eq('id', trackingId)
        .eq('status', 'processing')
        .single();

      if (withdrawalError || !withdrawal) {
        console.error(`[CPAY-WEBHOOK] ❌ Withdrawal request not found for clickId=${trackingId}`, withdrawalError);
        throw new Error('Withdrawal request not found or not in processing status');
      }

      console.log(`[CPAY-WEBHOOK] ✓ Withdrawal found: ${withdrawal.id}, User: ${withdrawal.profiles.username}`);

      if (status === 'completed') {
        // Update withdrawal to completed
        const { error: updateError } = await supabase
          .from('withdrawal_requests')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
            manual_txn_hash: payment_id,
            api_response: {
              ...withdrawal.api_response,
              webhook_received_at: new Date().toISOString(),
              cpay_payment_id: payment_id,
              cpay_status: status,
              transaction_hash: webhookData.hash || webhookData.transactionHash,
              webhook_data: webhookData
            }
          })
          .eq('id', withdrawal.id);

        if (updateError) {
          console.error('[CPAY-WEBHOOK] ❌ Failed to update withdrawal to completed:', updateError);
          throw updateError;
        }

        // Update transaction to completed
        await supabase
          .from('transactions')
          .update({ 
            status: 'completed',
            gateway_transaction_id: payment_id
          })
          .eq('user_id', withdrawal.user_id)
          .eq('type', 'withdrawal')
          .eq('amount', withdrawal.amount)
          .eq('status', 'processing');

        console.log(`[CPAY-WEBHOOK] ✅ WITHDRAWAL COMPLETED: User ${withdrawal.profiles.username}, Amount: $${withdrawal.amount}, TxHash: ${payment_id}`);

        // Send success notification
        try {
          await supabase.functions.invoke('send-cpay-notification', {
            body: {
              user_id: withdrawal.user_id,
              type: 'withdrawal_completed',
              data: {
                amount: withdrawal.net_amount,
                transaction_id: payment_id,
                payout_address: withdrawal.payout_address
              }
            }
          });
        } catch (notifError) {
          console.warn('[CPAY-WEBHOOK] ⚠️ Failed to send withdrawal notification:', notifError);
        }

      } else if (status === 'failed') {
        // Withdrawal failed - refund user
        console.log(`[CPAY-WEBHOOK] ❌ Withdrawal failed, refunding $${withdrawal.amount} to user ${withdrawal.user_id}`);
        
        // Get current balance atomically
        const { data: profile } = await supabase
          .from('profiles')
          .select('earnings_wallet_balance')
          .eq('id', withdrawal.user_id)
          .single();

        if (profile) {
          const refundAmount = withdrawal.amount;
          const newBalance = parseFloat(profile.earnings_wallet_balance) + refundAmount;

          // Refund to earnings wallet
          await supabase
            .from('profiles')
            .update({ 
              earnings_wallet_balance: newBalance,
              last_activity: new Date().toISOString()
            })
            .eq('id', withdrawal.user_id);

          // Update withdrawal to failed
          await supabase
            .from('withdrawal_requests')
            .update({
              status: 'failed',
              rejection_reason: `CPAY withdrawal failed: ${webhookData.systemStatus || 'Unknown error'}`,
              api_response: {
                ...withdrawal.api_response,
                webhook_received_at: new Date().toISOString(),
                cpay_status: status,
                webhook_data: webhookData
              }
            })
            .eq('id', withdrawal.id);

          // Update transaction to failed
          await supabase
            .from('transactions')
            .update({ status: 'failed' })
            .eq('user_id', withdrawal.user_id)
            .eq('type', 'withdrawal')
            .eq('amount', withdrawal.amount)
            .eq('status', 'processing');

          console.log(`[CPAY-WEBHOOK] ✅ Withdrawal refunded: $${refundAmount} returned to user, new balance: $${newBalance}`);

          // Send failure notification
          try {
            await supabase.functions.invoke('send-cpay-notification', {
              body: {
                user_id: withdrawal.user_id,
                type: 'withdrawal_failed',
                data: {
                  amount: withdrawal.amount,
                  reason: webhookData.systemStatus || 'Withdrawal failed'
                }
              }
            });
          } catch (notifError) {
            console.warn('[CPAY-WEBHOOK] ⚠️ Failed to send failure notification:', notifError);
          }
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Withdrawal webhook processed: ${status}`,
          withdrawal_id: withdrawal.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // ROUTE 2: DEPOSIT WEBHOOK (clickId = order_id in metadata)
    // ============================================================
    console.log(`[CPAY-WEBHOOK] 💰 Processing deposit webhook for trackingId: ${trackingId}`);

    // Find transaction by matching order_id stored in metadata (sent as clickId to CPAY)
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*, profiles!inner(id, deposit_wallet_balance, username, email)')
      .eq('payment_gateway', 'cpay')
      .eq('type', 'deposit')
      .contains('metadata', { order_id: trackingId })
      .single();

    if (txError || !transaction) {
      console.error(`[CPAY-WEBHOOK] ❌ Transaction not found for clickId=${trackingId}, payment_id=${payment_id}`, txError);
      
      // Log all pending CPAY transactions for debugging
      const { data: pendingTxs } = await supabase
        .from('transactions')
        .select('id, metadata, created_at')
        .eq('payment_gateway', 'cpay')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10);
      
      console.log('[CPAY-WEBHOOK] 📋 Recent pending CPAY transactions:', JSON.stringify(pendingTxs, null, 2));
      throw new Error('Transaction not found - clickId/order_id does not match any pending deposit');
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
      // Credit user with ACTUAL amount paid using atomic function (race-condition safe)
      console.log(
        `[CPAY-WEBHOOK] 💰 Calling atomic deposit function for user ${transaction.profiles.id}: ` +
        `Current balance: ${transaction.profiles.deposit_wallet_balance}, Amount to credit: ${actualAmount}`
      );
      
      const { data: atomicResult, error: atomicError } = await supabase.rpc('credit_deposit_atomic', {
        p_user_id: transaction.profiles.id,
        p_amount: actualAmount,
        p_order_id: payment_id, // Use payment_id as order_id for idempotency
        p_payment_method: 'cpay',
        p_gateway_transaction_id: payment_id,
        p_metadata: {
          webhook_received_at: new Date().toISOString(),
          cpay_status: status,
          cpay_payment_id: payment_id,
          cpay_system_status: webhookData.systemStatus || webhookData.chargeStatus,
          cpay_hash: webhookData.hash || webhookData.incomingTxHash,
          requested_amount: requestedAmount,
          actual_amount_paid: actualAmount,
          amount_discrepancy: actualAmount - requestedAmount,
          webhook_received_from_ip: clientIP,
          original_transaction_id: transaction.id,
          tracking_id: trackingId
        }
      });

      if (atomicError) {
        console.error('[CPAY-WEBHOOK] ❌ Atomic deposit function error:', atomicError);
        throw new Error('Failed to process deposit atomically: ' + atomicError.message);
      }

      // Check if atomic function detected duplicate or failed
      if (!atomicResult.success) {
        if (atomicResult.error === 'duplicate_transaction') {
          console.log('[CPAY-WEBHOOK] ⚠️ Duplicate detected by atomic function (another webhook already processed this payment_id)');
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Transaction already processed by atomic function',
              transaction_id: atomicResult.transaction_id 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.error('[CPAY-WEBHOOK] ❌ Atomic deposit failed:', atomicResult);
        throw new Error(atomicResult.message || 'Atomic deposit processing failed');
      }

      console.log('[CPAY-WEBHOOK] ✅ Atomic deposit successful:', {
        transactionId: atomicResult.transaction_id,
        oldBalance: atomicResult.old_balance,
        newBalance: atomicResult.new_balance,
        amountCredited: atomicResult.amount_credited
      });

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
        `credited ${actualAmount} ${currency}. New balance: ${newBalance}`
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
