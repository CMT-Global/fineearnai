import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessPaymentRequest {
  withdrawal_request_id: string;
  action: 'pay_via_api' | 'mark_paid_manually' | 'reject';
  rejection_reason?: string;
  manual_payment_notes?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    // Verify admin role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      throw new Error('Admin privileges required');
    }

    // Parse request body
    const { withdrawal_request_id, action, rejection_reason, manual_payment_notes }: ProcessPaymentRequest = await req.json();

    console.log(`Processing withdrawal ${withdrawal_request_id} with action: ${action}`);

    // Fetch withdrawal request
    const { data: withdrawal, error: fetchError } = await supabase
      .from('withdrawal_requests')
      .select('*, profiles!inner(id, username, email, earnings_wallet_balance)')
      .eq('id', withdrawal_request_id)
      .single();

    if (fetchError || !withdrawal) {
      throw new Error('Withdrawal request not found');
    }

    if (withdrawal.status !== 'pending') {
      throw new Error(`Cannot process withdrawal with status: ${withdrawal.status}`);
    }

    // Handle different actions
    switch (action) {
      case 'mark_paid_manually':
        return await handleMarkPaidManually(supabase, withdrawal, user.id, manual_payment_notes);
      
      case 'pay_via_api':
        return await handlePayViaAPI(supabase, withdrawal, user.id);
      
      case 'reject':
        if (!rejection_reason?.trim()) {
          throw new Error('Rejection reason is required');
        }
        return await handleReject(supabase, withdrawal, user.id, rejection_reason);
      
      default:
        throw new Error(`Invalid action: ${action}`);
    }

  } catch (error: any) {
    console.error('Error processing withdrawal:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Action: Mark as Paid Manually
async function handleMarkPaidManually(supabase: any, withdrawal: any, adminId: string, notes?: string) {
  console.log(`Marking withdrawal ${withdrawal.id} as paid manually`);

  // Update withdrawal request
  const { error: updateError } = await supabase
    .from('withdrawal_requests')
    .update({
      status: 'completed',
      processed_by: adminId,
      processed_at: new Date().toISOString(),
      manual_txn_hash: 'Manual payout confirmed by admin',
      admin_notes: notes || 'Marked as paid manually',
      updated_at: new Date().toISOString(),
    })
    .eq('id', withdrawal.id);

  if (updateError) throw updateError;

  // Update transaction to completed
  const { error: txnError } = await supabase
    .from('transactions')
    .update({ status: 'completed' })
    .eq('user_id', withdrawal.user_id)
    .eq('type', 'withdrawal')
    .eq('amount', withdrawal.amount)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1);

  if (txnError) console.error('Transaction update error:', txnError);

  // Send notification (fixed payload structure)
  await supabase.functions.invoke('send-cpay-notification', {
    body: {
      user_id: withdrawal.user_id,
      type: 'withdrawal_completed',
      data: {
        amount: withdrawal.net_amount,
        payout_address: withdrawal.payout_address
      }
    }
  }).catch((err: any) => console.error('Notification error:', err));

  // Audit log
  await supabase
    .from('audit_logs')
    .insert({
      admin_id: adminId,
      action_type: 'withdrawal_marked_paid_manually',
      target_user_id: withdrawal.user_id,
      details: {
        withdrawal_id: withdrawal.id,
        amount: withdrawal.amount,
        notes: notes || 'Marked as paid manually'
      }
    });

  console.log(`Withdrawal ${withdrawal.id} marked as paid successfully`);

  return new Response(
    JSON.stringify({ 
      success: true, 
      status: 'completed',
      message: 'Withdrawal marked as paid successfully' 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Action: Pay Via API
async function handlePayViaAPI(supabase: any, withdrawal: any, adminId: string) {
  console.log(`Processing API payment for withdrawal ${withdrawal.id}`);

  // Detect payment provider
  const provider = detectPaymentProvider(withdrawal.payment_method);
  console.log(`Detected payment provider: ${provider}`);

  // Update status to processing
  await supabase
    .from('withdrawal_requests')
    .update({ 
      status: 'processing',
      payment_provider: provider,
      updated_at: new Date().toISOString()
    })
    .eq('id', withdrawal.id);

  try {
    // Call appropriate payment API
    let apiResponse;
    switch (provider) {
      case 'cpay':
        apiResponse = await processCPAYWithdrawal(withdrawal);
        break;
      case 'payeer':
        apiResponse = await processPayeerWithdrawal(withdrawal);
        break;
      default:
        throw new Error(`Payment provider ${provider} not supported for API payments`);
    }

    // API call succeeded
    console.log('API payment response:', apiResponse);

    // Check if withdrawal is fully completed or just initiated (processing)
    if (apiResponse.status === 'processing') {
      // Withdrawal initiated but awaiting confirmation
      console.log(`Withdrawal ${withdrawal.id} initiated with ${provider}, awaiting confirmation`);
      
      await supabase
        .from('withdrawal_requests')
        .update({
          status: 'processing',
          processed_by: adminId,
          api_response: apiResponse,
          updated_at: new Date().toISOString(),
        })
        .eq('id', withdrawal.id);

      // Update transaction to processing
      await supabase
        .from('transactions')
        .update({ 
          status: 'processing',
          gateway_transaction_id: apiResponse.cpay_withdrawal_id
        })
        .eq('user_id', withdrawal.user_id)
        .eq('type', 'withdrawal')
        .eq('amount', withdrawal.amount)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      // Audit log
      await supabase
        .from('audit_logs')
        .insert({
          admin_id: adminId,
          action_type: 'withdrawal_initiated_via_api',
          target_user_id: withdrawal.user_id,
          details: {
            withdrawal_id: withdrawal.id,
            amount: withdrawal.amount,
            provider: provider,
            cpay_withdrawal_id: apiResponse.cpay_withdrawal_id,
            note: 'Withdrawal initiated, awaiting blockchain confirmation'
          }
        });

      return new Response(
        JSON.stringify({ 
          success: true, 
          status: 'processing',
          cpay_withdrawal_id: apiResponse.cpay_withdrawal_id,
          message: `Withdrawal initiated with ${provider}. ID: ${apiResponse.cpay_withdrawal_id}. Awaiting confirmation.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Withdrawal fully completed with transaction hash
    await supabase
      .from('withdrawal_requests')
      .update({
        status: 'completed',
        processed_by: adminId,
        processed_at: new Date().toISOString(),
        manual_txn_hash: apiResponse.transaction_hash || 'API Payment',
        api_response: apiResponse,
        updated_at: new Date().toISOString(),
      })
      .eq('id', withdrawal.id);

    // Update transaction
    await supabase
      .from('transactions')
      .update({ 
        status: 'completed',
        gateway_transaction_id: apiResponse.transaction_hash
      })
      .eq('user_id', withdrawal.user_id)
      .eq('type', 'withdrawal')
      .eq('amount', withdrawal.amount)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    // Send success notification (fixed payload structure)
    await supabase.functions.invoke('send-cpay-notification', {
      body: {
        user_id: withdrawal.user_id,
        type: 'withdrawal_completed',
        data: {
          amount: withdrawal.net_amount,
          transaction_id: apiResponse.transaction_hash,
          payout_address: withdrawal.payout_address
        }
      }
    }).catch((err: any) => console.error('Notification error:', err));

    // Audit log
    await supabase
      .from('audit_logs')
      .insert({
        admin_id: adminId,
        action_type: 'withdrawal_paid_via_api',
        target_user_id: withdrawal.user_id,
        details: {
          withdrawal_id: withdrawal.id,
          amount: withdrawal.amount,
          provider: provider,
          transaction_hash: apiResponse.transaction_hash
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        status: 'completed',
        transaction_hash: apiResponse.transaction_hash,
        message: 'Payment sent successfully via API' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (apiError: any) {
    console.error('API payment failed:', apiError);

    // CRITICAL: Keep withdrawal as PENDING (do NOT refund user or mark as failed)
    // This allows admin to retry payment or manually reject if needed
    await supabase
      .from('withdrawal_requests')
      .update({
        status: 'pending', // Keep as pending for admin retry
        api_response: { 
          error: apiError.message,
          details: apiError.details || apiError.toString(),
          failed_at: new Date().toISOString(),
          provider: provider
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', withdrawal.id);

    // DO NOT refund user's wallet - funds already deducted, waiting for successful payout
    // DO NOT update transaction to failed - keep as pending
    // DO NOT send failure notification to user - withdrawal is still being processed

    // Audit log for admin awareness
    await supabase
      .from('audit_logs')
      .insert({
        admin_id: adminId,
        action_type: 'withdrawal_api_failed',
        target_user_id: withdrawal.user_id,
        details: {
          withdrawal_id: withdrawal.id,
          amount: withdrawal.amount,
          net_amount: withdrawal.net_amount,
          provider: provider,
          error: apiError.message,
          error_details: apiError.details || apiError.toString(),
          note: 'API call failed - withdrawal remains PENDING for admin retry or manual rejection'
        }
      });

    console.log(`Withdrawal ${withdrawal.id} API failed but remains PENDING for retry`);

    // Return success=true with api_failed flag for frontend handling
    return new Response(
      JSON.stringify({ 
        success: true,  // Action completed successfully (error was handled properly)
        api_failed: true, // But API call failed
        error_message: apiError.message,
        status: 'pending',
        provider: provider,
        message: `API payment failed: ${apiError.message}. Withdrawal remains PENDING - you can retry or reject manually.`
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

// Action: Reject
async function handleReject(supabase: any, withdrawal: any, adminId: string, rejectionReason: string) {
  console.log(`[REJECT] Starting rejection for withdrawal ${withdrawal.id}`);
  console.log(`[REJECT] User: ${withdrawal.user_id}, Amount to refund: ${withdrawal.amount}`);

  // CRITICAL FIX: Fetch current balance atomically (not from stale withdrawal query)
  const { data: userProfile, error: profileError } = await supabase
    .from('profiles')
    .select('earnings_wallet_balance')
    .eq('id', withdrawal.user_id)
    .single();

  if (profileError || !userProfile) {
    console.error('[REJECT] ❌ Failed to fetch user profile:', profileError);
    throw new Error(`Failed to fetch user profile: ${profileError?.message || 'Unknown error'}`);
  }

  const currentBalance = userProfile.earnings_wallet_balance;
  const newBalance = currentBalance + withdrawal.amount;

  console.log('[REJECT] 💰 Refund calculation:', {
    user_id: withdrawal.user_id,
    current_balance: currentBalance,
    refund_amount: withdrawal.amount,
    new_balance: newBalance
  });

  // Update withdrawal request to rejected
  const { error: updateError } = await supabase
    .from('withdrawal_requests')
    .update({
      status: 'rejected',
      rejection_reason: rejectionReason,
      processed_by: adminId,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', withdrawal.id);

  if (updateError) {
    console.error('[REJECT] ❌ Failed to update withdrawal:', updateError);
    throw new Error(`Failed to update withdrawal: ${updateError.message}`);
  }

  // Refund user's earnings wallet
  const { error: refundError } = await supabase
    .from('profiles')
    .update({
      earnings_wallet_balance: newBalance
    })
    .eq('id', withdrawal.user_id);

  if (refundError) {
    console.error('[REJECT] ❌ Failed to refund user:', refundError);
    throw new Error(`Failed to refund user: ${refundError.message}`);
  }

  console.log('[REJECT] ✅ Refund applied successfully');

  // Update corresponding transaction to failed
  const { error: txnError } = await supabase
    .from('transactions')
    .update({ status: 'failed' })
    .eq('user_id', withdrawal.user_id)
    .eq('type', 'withdrawal')
    .eq('amount', withdrawal.amount)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1);

  if (txnError) {
    console.error('[REJECT] ⚠️ Transaction update failed:', txnError);
    // Continue - not critical
  }

  // Send notification to user (fixed payload structure)
  await supabase.functions.invoke('send-cpay-notification', {
    body: {
      user_id: withdrawal.user_id,
      type: 'withdrawal_rejected',
      data: {
        amount: withdrawal.amount,
        reason: rejectionReason
      }
    }
  }).catch((err: any) => {
    console.error('[REJECT] ⚠️ Notification error:', err);
    // Continue - not critical
  });

  // Create audit log with detailed refund info
  const { error: auditError } = await supabase
    .from('audit_logs')
    .insert({
      admin_id: adminId,
      action_type: 'withdrawal_rejected',
      target_user_id: withdrawal.user_id,
      details: {
        withdrawal_id: withdrawal.id,
        amount: withdrawal.amount,
        reason: rejectionReason,
        refund_applied: true,
        old_balance: currentBalance,
        new_balance: newBalance
      }
    });

  if (auditError) {
    console.error('[REJECT] ⚠️ Audit log failed:', auditError);
    // Continue - not critical
  }

  console.log(`[REJECT] ✅ Withdrawal ${withdrawal.id} rejected successfully, funds refunded`);

  return new Response(
    JSON.stringify({ 
      success: true, 
      status: 'rejected',
      message: `Withdrawal rejected and $${withdrawal.amount} refunded to user's earnings wallet`,
      refund_details: {
        old_balance: currentBalance,
        new_balance: newBalance,
        refund_amount: withdrawal.amount
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Detect payment provider from payment method string
function detectPaymentProvider(paymentMethod: string): string {
  const method = paymentMethod.toLowerCase();
  
  if (method.includes('cpay') || method.includes('crypto payout')) {
    return 'cpay';
  }
  if (method.includes('payeer')) {
    return 'payeer';
  }
  
  // Default to manual if unknown
  return 'manual';
}

// Process CPAY withdrawal via API with proper authentication flow
async function processCPAYWithdrawal(withdrawal: any): Promise<{ 
  transaction_hash: string | null; 
  cpay_withdrawal_id?: string;
  provider: string; 
  success: boolean;
  status: string;
}> {
  // Helper function to format amount with fixed decimal places
  function formatAmount(value: number, decimals: number): string {
    return value.toFixed(decimals);
  }

  console.log('[CPAY-WITHDRAWAL] Starting CPAY withdrawal process...');

  // Validate required CPAY credentials
  const CPAY_API_PUBLIC_KEY = Deno.env.get('CPAY_API_PUBLIC_KEY');
  const CPAY_API_PRIVATE_KEY = Deno.env.get('CPAY_API_PRIVATE_KEY');
  const CPAY_WALLET_ID = Deno.env.get('CPAY_WALLET_ID');
  const CPAY_WALLET_PASSPHRASE = Deno.env.get('CPAY_WALLET_PASSPHRASE');

  console.log('[CPAY-WITHDRAWAL] 🔍 Credential check:', {
    hasPublicKey: !!CPAY_API_PUBLIC_KEY,
    hasPrivateKey: !!CPAY_API_PRIVATE_KEY,
    hasWalletId: !!CPAY_WALLET_ID,
    hasPassphrase: !!CPAY_WALLET_PASSPHRASE
  });

  const missingVars = [];
  if (!CPAY_API_PUBLIC_KEY) missingVars.push('CPAY_API_PUBLIC_KEY');
  if (!CPAY_API_PRIVATE_KEY) missingVars.push('CPAY_API_PRIVATE_KEY');
  if (!CPAY_WALLET_ID) missingVars.push('CPAY_WALLET_ID');
  if (!CPAY_WALLET_PASSPHRASE) missingVars.push('CPAY_WALLET_PASSPHRASE');

  if (missingVars.length > 0) {
    const errorMsg = `Missing CPAY credentials: ${missingVars.join(', ')}`;
    console.error('[CPAY-WITHDRAWAL] ❌ Configuration Error:', errorMsg);
    throw new Error(errorMsg);
  }

  console.log('[CPAY-WITHDRAWAL] ✅ All credentials present, proceeding with two-step auth...');

  try {
    // ============================================================
    // STEP 1: Account Authentication
    // ============================================================
    console.log('[CPAY-WITHDRAWAL] 📡 Step 1/2: Account authentication...');
    
    const accountAuthResponse = await fetch('https://api.cpay.world/api/public/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publicKey: CPAY_API_PUBLIC_KEY,
        privateKey: CPAY_API_PRIVATE_KEY,
      }),
    });

    const accountAuthText = await accountAuthResponse.text();
    console.log('[CPAY-WITHDRAWAL] Step 1 response status:', accountAuthResponse.status);
    console.log('[CPAY-WITHDRAWAL] Step 1 response body:', accountAuthText);

    if (!accountAuthResponse.ok) {
      const errorMsg = accountAuthResponse.status === 401 || accountAuthResponse.status === 403
        ? 'Invalid CPAY API credentials (check publicKey/privateKey in secrets)'
        : `CPAY account authentication failed (${accountAuthResponse.status}): ${accountAuthText}`;
      console.error('[CPAY-WITHDRAWAL] ❌ Account auth failed:', errorMsg);
      throw new Error(errorMsg);
    }

    let accountAuthData;
    try {
      accountAuthData = JSON.parse(accountAuthText);
    } catch (e) {
      throw new Error(`CPAY account auth response is not valid JSON: ${accountAuthText}`);
    }

    const accountToken = accountAuthData.token || accountAuthData.access_token || accountAuthData.jwt;

    if (!accountToken) {
      console.error('[CPAY-WITHDRAWAL] ❌ No token in account auth response:', accountAuthData);
      throw new Error('CPAY account auth response missing token field');
    }

    console.log('[CPAY-WITHDRAWAL] ✅ Step 1 complete: Account authenticated');

    // ============================================================
    // STEP 2: Wallet Authentication
    // ============================================================
    console.log('[CPAY-WITHDRAWAL] 📡 Step 2/2: Wallet authentication...');
    
    const walletAuthResponse = await fetch('https://api.cpay.world/api/public/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletId: CPAY_WALLET_ID,
        passphrase: CPAY_WALLET_PASSPHRASE,
        publicKey: CPAY_API_PUBLIC_KEY,
        privateKey: CPAY_API_PRIVATE_KEY,
      }),
    });

    const walletAuthText = await walletAuthResponse.text();
    console.log('[CPAY-WITHDRAWAL] Step 2 response status:', walletAuthResponse.status);
    console.log('[CPAY-WITHDRAWAL] Step 2 response body:', walletAuthText);

    if (!walletAuthResponse.ok) {
      const errorMsg = walletAuthResponse.status === 401
        ? 'Invalid wallet credentials (check walletId/passphrase in secrets)'
        : walletAuthResponse.status === 403
        ? 'Wallet access forbidden (check wallet permissions in CPAY dashboard)'
        : `CPAY wallet authentication failed (${walletAuthResponse.status}): ${walletAuthText}`;
      console.error('[CPAY-WITHDRAWAL] ❌ Wallet auth failed:', errorMsg);
      throw new Error(errorMsg);
    }

    let walletAuthData;
    try {
      walletAuthData = JSON.parse(walletAuthText);
    } catch (e) {
      throw new Error(`CPAY wallet auth response is not valid JSON: ${walletAuthText}`);
    }

    const walletBearerToken = walletAuthData.token || walletAuthData.access_token || walletAuthData.jwt;

    if (!walletBearerToken) {
      console.error('[CPAY-WITHDRAWAL] ❌ No token in wallet auth response:', walletAuthData);
      throw new Error('CPAY wallet auth response missing token field');
    }

    console.log('[CPAY-WITHDRAWAL] ✅ Step 2 complete: Wallet authenticated');
    console.log('[CPAY-WITHDRAWAL] 🔑 Using wallet-specific Bearer token for withdrawal');

    // ============================================================
    // STEP 3: Perform Account Wallet Withdrawal (REQUIRES currencyToken)
    // ============================================================
    console.log('[CPAY-WITHDRAWAL] 📡 Step 3/3: Calling CPAY withdrawal endpoint...');

    // Get USDT token ID from environment
    const CPAY_USDT_TOKEN_ID = Deno.env.get('CPAY_USDT_TOKEN_ID');

    if (!CPAY_USDT_TOKEN_ID) {
      throw new Error('CPAY_USDT_TOKEN_ID not configured - required for Account Wallet withdrawals');
    }

    // Construct withdrawal payload per CPAY documentation
    // Documentation: Page 17 - currencyToken is REQUIRED for account wallet withdrawals
    // ✅ CRITICAL: CPAY requires amount as STRING with fixed decimals
    const withdrawalPayload: any = {
      to: withdrawal.payout_address,
      amount: formatAmount(parseFloat(withdrawal.net_amount), 2),  // Start with 2 decimals
      currencyToken: CPAY_USDT_TOKEN_ID  // ✅ REQUIRED field for Account Wallet
    };

    console.log('[CPAY-WITHDRAWAL] 📦 Withdrawal payload:', {
      to: `${withdrawalPayload.to.substring(0, 8)}...${withdrawalPayload.to.substring(withdrawalPayload.to.length - 8)}`,
      amount: withdrawalPayload.amount,
      amountType: typeof withdrawalPayload.amount,
      currencyToken: CPAY_USDT_TOKEN_ID,
      currencyTokenLength: CPAY_USDT_TOKEN_ID.length
    });
    
    // ============================================================
    // STEP 3.1: Generate Unique Idempotency Key for This Attempt
    // ============================================================
    // This ensures each admin retry gets a fresh API call (not cached by CPAY)
    const attemptKeyBase = `${withdrawal.id}-${Date.now()}`;
    console.log('[CPAY-WITHDRAWAL] 🔑 Idempotency key for this attempt:', attemptKeyBase);
    
    // ============================================================
    // STEP 3.2: Log FULL REQUEST Before Sending
    // ============================================================
    const requestBody = JSON.stringify(withdrawalPayload);
    console.log('[CPAY-WITHDRAWAL] 📤 FULL REQUEST:', {
      url: 'https://api.cpay.world/api/public/withdrawal',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ***',
        'Idempotency-Key': attemptKeyBase
      },
      body: requestBody,
      bodyLength: requestBody.length,
      parsedBody: withdrawalPayload
    });

    // ============================================================
    // STEP 3.3: Make Primary Withdrawal Request
    // ============================================================
    let withdrawalResponse = await fetch('https://api.cpay.world/api/public/withdrawal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${walletBearerToken}`,
        'Idempotency-Key': attemptKeyBase,
      },
      body: requestBody,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    let responseText = await withdrawalResponse.text();
    console.log('[CPAY-WITHDRAWAL] Withdrawal response status:', withdrawalResponse.status);
    console.log('[CPAY-WITHDRAWAL] Withdrawal response body (truncated):', responseText.substring(0, 500));
    
    // 🔍 DETAILED LOGGING: Log exact response headers
    console.log('[CPAY-WITHDRAWAL] 📥 EXACT RESPONSE BODY:', responseText);
    console.log('[CPAY-WITHDRAWAL] 📥 RESPONSE HEADERS:', Object.fromEntries(withdrawalResponse.headers.entries()));

    // ============================================================
    // FALLBACK 1: Retry with 6 decimal precision if amount format error
    // ============================================================
    if (!withdrawalResponse.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch (e) {
        errorData = { message: responseText };
      }

      const errorMessage = errorData.data?.message || errorData.message || responseText;
      const errorString = Array.isArray(errorMessage) ? errorMessage.join('; ') : String(errorMessage);
      const lowerError = errorString.toLowerCase();

      // Check if error is about amount format
      const isAmountFormatError = lowerError.includes('amount must be a number string');

      if (isAmountFormatError) {
        console.log('[CPAY-WITHDRAWAL] ⚠️ Amount format error detected, retrying with 6 decimal precision...');
        
        // Update amount to 6 decimal precision
        withdrawalPayload.amount = formatAmount(parseFloat(withdrawal.net_amount), 6);
        
        const retryIdempotencyKey = `${attemptKeyBase}-6dp`;
        
        console.log('[CPAY-WITHDRAWAL] 🔄 Retry payload (6dp):', {
          to: `${withdrawalPayload.to.substring(0, 8)}...${withdrawalPayload.to.substring(withdrawalPayload.to.length - 8)}`,
          amount: withdrawalPayload.amount,
          amountType: typeof withdrawalPayload.amount,
          amountPrecision: '6dp',
          currencyTokenIncluded: 'currencyToken' in withdrawalPayload,
          idempotencyKey: retryIdempotencyKey
        });

        // 🔍 DETAILED LOGGING: Log exact retry request
        const retryRequestBody = JSON.stringify(withdrawalPayload);
        console.log('[CPAY-WITHDRAWAL] 📤 FULL RETRY REQUEST (6dp):', {
          url: 'https://api.cpay.world/api/public/withdrawal',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ***',
            'Idempotency-Key': retryIdempotencyKey
          },
          body: retryRequestBody,
          parsedBody: withdrawalPayload
        });

        // Retry withdrawal with 6dp amount
        withdrawalResponse = await fetch('https://api.cpay.world/api/public/withdrawal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${walletBearerToken}`,
            'Idempotency-Key': retryIdempotencyKey,
          },
          body: retryRequestBody,
          signal: AbortSignal.timeout(30000),
        });

        responseText = await withdrawalResponse.text();
        console.log('[CPAY-WITHDRAWAL] 🔄 Retry response status (6dp):', withdrawalResponse.status);
        console.log('[CPAY-WITHDRAWAL] 🔄 Retry response body (truncated):', responseText.substring(0, 500));
        console.log('[CPAY-WITHDRAWAL] 📥 EXACT RETRY RESPONSE BODY (6dp):', responseText);
      }
    }


    // Parse final response
    if (!withdrawalResponse.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch (e) {
        errorData = { message: responseText };
      }

      const errorMessage = errorData.data?.message || errorData.message || responseText;
      const errorString = Array.isArray(errorMessage) ? errorMessage.join('; ') : String(errorMessage);
      const lowerError = errorString.toLowerCase();
      
      // Provide specific error messages based on CPAY responses
      let errorMsg = `CPAY withdrawal failed (${withdrawalResponse.status})`;
      
      if (lowerError.includes('insufficient') || lowerError.includes('not enough')) {
        errorMsg = `Insufficient CPAY wallet balance: ${errorString}`;
      } else if (lowerError.includes('currency not supported') || lowerError.includes('currency')) {
        errorMsg = `CPAY currency error (check CPAY_USDT_TOKEN_ID is correct): ${errorString}`;
      } else if (lowerError.includes('address') && lowerError.includes('invalid')) {
        errorMsg = `Invalid USDT (TRC20) address: ${withdrawal.payout_address}`;
      } else if (withdrawalResponse.status === 401 || withdrawalResponse.status === 403) {
        errorMsg = `CPAY authentication error - verify wallet credentials`;
      } else {
        errorMsg = `${errorMsg}: ${errorString}`;
      }
      
      console.error('[CPAY-WITHDRAWAL] ❌ Final error:', errorMsg);
      throw new Error(errorMsg);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`CPAY withdrawal response is not valid JSON: ${responseText}`);
    }

    // Check for completed withdrawal (has transaction hash)
    if (data.success !== false && (data.transactionHash || data.txHash || data.hash)) {
      const txHash = data.transactionHash || data.txHash || data.hash;
      console.log('[CPAY-WITHDRAWAL] ✅ Withdrawal completed with transaction hash:', txHash);
      return {
        transaction_hash: txHash,
        cpay_withdrawal_id: data.data?.id,
        provider: 'cpay',
        success: true,
        status: 'completed'
      };
    }
    
    // Check for initiated withdrawal (has withdrawal ID but no hash yet)
    if (data.success !== false && data.data?.id) {
      const withdrawalId = data.data.id;
      console.log('[CPAY-WITHDRAWAL] ⏳ Withdrawal initiated with CPAY, ID:', withdrawalId);
      return {
        transaction_hash: null,
        cpay_withdrawal_id: withdrawalId,
        provider: 'cpay',
        success: true,
        status: 'processing'
      };
    }
    
    // Neither hash nor ID - actual failure
    throw new Error(data.error || data.message || 'CPAY withdrawal failed - no transaction hash or withdrawal ID received');

  } catch (error) {
    console.error('[CPAY-WITHDRAWAL] ❌ Exception:', error);
    throw error;
  }
}


// Process Payeer withdrawal via API (placeholder for future implementation)
async function processPayeerWithdrawal(withdrawal: any): Promise<{ 
  transaction_hash: string | null; 
  cpay_withdrawal_id?: string;
  provider: string; 
  success: boolean;
  status: string;
}> {
  // TODO: Implement Payeer API integration
  throw new Error('Payeer API integration not yet implemented');
}
