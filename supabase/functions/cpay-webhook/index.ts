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

    const webhookData = await req.json();
    
    console.log('[CPAY-WEBHOOK] 📥 Webhook received from IP:', clientIP);
    console.log('[CPAY-WEBHOOK] 📦 Full payload:', JSON.stringify(webhookData, null, 2));

    // Verify webhook signature
    const { signature, ...dataToVerify } = webhookData;
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
      console.error('Invalid webhook signature');
      throw new Error('Invalid signature');
    }

    // Extract webhook data - CPAY sends clickId which matches our order_id
    const { 
      clickId, 
      payment_id, 
      status, 
      amount: webhookAmount, 
      currency,
      order_id // Some CPAY webhooks may send order_id instead of clickId
    } = webhookData;

    const trackingId = clickId || order_id;
    
    console.log(`[CPAY-WEBHOOK] 🔍 Processing: clickId/order_id=${trackingId}, payment_id=${payment_id}, status=${status}, amount=${webhookAmount} ${currency}`);

    if (!trackingId) {
      console.error('[CPAY-WEBHOOK] ❌ No clickId or order_id in webhook payload');
      throw new Error('Missing clickId/order_id in webhook');
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
    const actualAmount = parseFloat(webhookAmount);
    
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
    if (status === 'completed' || status === 'success') {
      // Credit user with ACTUAL amount paid (not requested amount)
      const newBalance = transaction.profiles.deposit_wallet_balance + actualAmount;
      
      console.log(
        `[CPAY-WEBHOOK] 💰 Crediting user ${transaction.profiles.id}: ` +
        `${transaction.profiles.deposit_wallet_balance} + ${actualAmount} = ${newBalance}`
      );
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ deposit_wallet_balance: newBalance })
        .eq('id', transaction.profiles.id);

      if (updateError) {
        console.error('[CPAY-WEBHOOK] ❌ Failed to update balance:', updateError);
        throw new Error('Failed to update balance');
      }

      // Update transaction with actual amount and new balance
      const { error: txUpdateError } = await supabase
        .from('transactions')
        .update({
          status: 'completed',
          amount: actualAmount, // Update to actual amount paid
          new_balance: newBalance,
          gateway_transaction_id: payment_id, // Store CPAY's payment_id
          metadata: {
            ...transaction.metadata,
            webhook_received_at: new Date().toISOString(),
            cpay_status: status,
            cpay_payment_id: payment_id,
            requested_amount: requestedAmount,
            actual_amount_paid: actualAmount,
            amount_discrepancy: actualAmount - requestedAmount,
            webhook_payload: webhookData, // Store full webhook for debugging
          },
        })
        .eq('id', transaction.id);

      if (txUpdateError) {
        console.error('[CPAY-WEBHOOK] ❌ Failed to update transaction:', txUpdateError);
        throw new Error('Failed to update transaction');
      }

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

    } else if (status === 'failed' || status === 'cancelled' || status === 'expired') {
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
            webhook_payload: webhookData,
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
