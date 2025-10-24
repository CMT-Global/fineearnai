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

  // Send notification
  await supabase.functions.invoke('send-cpay-notification', {
    body: {
      user_id: withdrawal.user_id,
      type: 'withdrawal_completed',
      withdrawal_id: withdrawal.id,
      amount: withdrawal.net_amount,
      message: 'Your withdrawal has been processed successfully.'
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
    console.log('API payment successful:', apiResponse);

    // Update withdrawal to completed
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

    // Send success notification
    await supabase.functions.invoke('send-cpay-notification', {
      body: {
        user_id: withdrawal.user_id,
        type: 'withdrawal_completed',
        withdrawal_id: withdrawal.id,
        amount: withdrawal.net_amount,
        message: `Your withdrawal has been sent successfully. Transaction ID: ${apiResponse.transaction_hash}`
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
  console.log(`Rejecting withdrawal ${withdrawal.id}`);

  // Update withdrawal request
  await supabase
    .from('withdrawal_requests')
    .update({
      status: 'rejected',
      rejection_reason: rejectionReason,
      processed_by: adminId,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', withdrawal.id);

  // Refund user's earnings wallet
  await supabase
    .from('profiles')
    .update({
      earnings_wallet_balance: withdrawal.profiles.earnings_wallet_balance + withdrawal.amount
    })
    .eq('id', withdrawal.user_id);

  // Update transaction
  await supabase
    .from('transactions')
    .update({ status: 'failed' })
    .eq('user_id', withdrawal.user_id)
    .eq('type', 'withdrawal')
    .eq('amount', withdrawal.amount)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1);

  // Send notification
  await supabase.functions.invoke('send-cpay-notification', {
    body: {
      user_id: withdrawal.user_id,
      type: 'withdrawal_rejected',
      withdrawal_id: withdrawal.id,
      amount: withdrawal.amount,
      message: `Your withdrawal was rejected: ${rejectionReason}. Funds have been refunded to your earnings wallet.`
    }
  }).catch((err: any) => console.error('Notification error:', err));

  // Audit log
  await supabase
    .from('audit_logs')
    .insert({
      admin_id: adminId,
      action_type: 'withdrawal_rejected',
      target_user_id: withdrawal.user_id,
      details: {
        withdrawal_id: withdrawal.id,
        amount: withdrawal.amount,
        reason: rejectionReason
      }
    });

  console.log(`Withdrawal ${withdrawal.id} rejected successfully`);

  return new Response(
    JSON.stringify({ 
      success: true, 
      status: 'rejected',
      message: 'Withdrawal rejected and funds refunded' 
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
async function processCPAYWithdrawal(withdrawal: any) {
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
    // STEP 3: Perform Withdrawal (minimal payload - no currencyToken)
    // ============================================================
    console.log('[CPAY-WITHDRAWAL] 📡 Step 3/3: Calling CPAY withdrawal endpoint...');

    // Construct minimal withdrawal payload (CPAY auto-detects USDT TRC20)
    // ✅ LASER FIX: Remove dependency on unreliable currency API
    // ✅ CRITICAL: CPAY requires amount as STRING with fixed decimals
    // Documentation: Lines 1360, 672-680 in CPAY_WITHDRAWALS_API-2.docx
    // Starting with 2 decimal places (e.g., "28.10" not "28.1")
    const withdrawalPayload: any = {
      to: withdrawal.payout_address,              // ✅ Correct field name
      amount: formatAmount(parseFloat(withdrawal.net_amount), 2),  // ✅ String with 2 decimals
      // ❌ currencyToken REMOVED - CPAY should auto-detect for USDT TRC20
    };

    console.log('[CPAY-WITHDRAWAL] 📦 Minimal withdrawal payload:', {
      to: `${withdrawalPayload.to.substring(0, 8)}...${withdrawalPayload.to.substring(withdrawalPayload.to.length - 8)}`,
      amount: withdrawalPayload.amount,
      amountType: typeof withdrawalPayload.amount,  // ✅ Verify it's "string"
      amountPrecision: '2dp',
      currencyTokenIncluded: 'currencyToken' in withdrawalPayload
    });

    // Attempt withdrawal with minimal payload
    let withdrawalResponse = await fetch('https://api.cpay.world/api/public/withdrawal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${walletBearerToken}`,
        'Idempotency-Key': withdrawal.id,
      },
      body: JSON.stringify(withdrawalPayload),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    let responseText = await withdrawalResponse.text();
    console.log('[CPAY-WITHDRAWAL] Withdrawal response status:', withdrawalResponse.status);
    console.log('[CPAY-WITHDRAWAL] Withdrawal response body (truncated):', responseText.substring(0, 500));

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
        
        console.log('[CPAY-WITHDRAWAL] 🔄 Retry payload (6dp):', {
          to: `${withdrawalPayload.to.substring(0, 8)}...${withdrawalPayload.to.substring(withdrawalPayload.to.length - 8)}`,
          amount: withdrawalPayload.amount,
          amountType: typeof withdrawalPayload.amount,
          amountPrecision: '6dp',
          currencyTokenIncluded: 'currencyToken' in withdrawalPayload
        });

        // Retry withdrawal with 6dp amount
        withdrawalResponse = await fetch('https://api.cpay.world/api/public/withdrawal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${walletBearerToken}`,
            'Idempotency-Key': `${withdrawal.id}-retry-6dp`,
          },
          body: JSON.stringify(withdrawalPayload),
          signal: AbortSignal.timeout(30000),
        });

        responseText = await withdrawalResponse.text();
        console.log('[CPAY-WITHDRAWAL] 🔄 Retry response status (6dp):', withdrawalResponse.status);
        console.log('[CPAY-WITHDRAWAL] 🔄 Retry response body (truncated):', responseText.substring(0, 500));
      }
    }

    // ============================================================
    // FALLBACK 2: Retry with currencyToken if CPAY requires it
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

      // Check if error is about missing currency token
      const isCurrencyError = 
        lowerError.includes('currency') && 
        (lowerError.includes('required') || lowerError.includes('must') || lowerError.includes('missing'));

      if (isCurrencyError) {
        const CPAY_USDT_TOKEN_ID = Deno.env.get('CPAY_USDT_TOKEN_ID');
        
        if (CPAY_USDT_TOKEN_ID) {
          console.log('[CPAY-WITHDRAWAL] ⚠️ Currency required by CPAY, retrying with CPAY_USDT_TOKEN_ID...');
          
          // Add currencyToken to payload
          withdrawalPayload.currencyToken = CPAY_USDT_TOKEN_ID;
          
          console.log('[CPAY-WITHDRAWAL] 🔄 Retry payload (with currency):', {
            to: `${withdrawalPayload.to.substring(0, 8)}...${withdrawalPayload.to.substring(withdrawalPayload.to.length - 8)}`,
            amount: withdrawalPayload.amount,
            amountType: typeof withdrawalPayload.amount,
            currencyToken: CPAY_USDT_TOKEN_ID
          });

          // Retry withdrawal with currencyToken
          withdrawalResponse = await fetch('https://api.cpay.world/api/public/withdrawal', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${walletBearerToken}`,
              'Idempotency-Key': `${withdrawal.id}-retry-currency`,
            },
            body: JSON.stringify(withdrawalPayload),
            signal: AbortSignal.timeout(30000),
          });

          responseText = await withdrawalResponse.text();
          console.log('[CPAY-WITHDRAWAL] 🔄 Retry response status (currency):', withdrawalResponse.status);
          console.log('[CPAY-WITHDRAWAL] 🔄 Retry response body (truncated):', responseText.substring(0, 500));
        } else {
          console.error('[CPAY-WITHDRAWAL] ❌ Currency required but CPAY_USDT_TOKEN_ID not configured');
          throw new Error(`CPAY requires currencyToken but CPAY_USDT_TOKEN_ID secret is not set. Original error: ${errorString}`);
        }
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
      
      // Provide specific error messages
      let errorMsg = `CPAY withdrawal failed (${withdrawalResponse.status})`;
      
      if (lowerError.includes('address') && lowerError.includes('invalid')) {
        errorMsg = `Invalid USDT (TRC20) address: ${withdrawal.payout_address}`;
      } else if (lowerError.includes('insufficient')) {
        errorMsg = `Insufficient CPAY wallet balance to process withdrawal`;
      } else if (lowerError.includes('currency')) {
        errorMsg = `Currency configuration error: ${errorString}`;
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

    if (data.success !== false && (data.transactionHash || data.txHash || data.hash)) {
      const txHash = data.transactionHash || data.txHash || data.hash;
      console.log('[CPAY-WITHDRAWAL] ✅ Withdrawal successful, transaction hash:', txHash);
      return {
        transaction_hash: txHash,
        provider: 'cpay',
        success: true
      };
    } else {
      throw new Error(data.error || data.message || 'CPAY withdrawal failed with no transaction hash');
    }

  } catch (error) {
    console.error('[CPAY-WITHDRAWAL] ❌ Exception:', error);
    throw error;
  }
}


// Process Payeer withdrawal via API (placeholder for future implementation)
async function processPayeerWithdrawal(withdrawal: any): Promise<{ transaction_hash: string; provider: string; success: boolean }> {
  // TODO: Implement Payeer API integration
  throw new Error('Payeer API integration not yet implemented');
}
