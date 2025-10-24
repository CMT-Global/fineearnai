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
    // Step 1: Authenticate and get Bearer token
    console.log('[CPAY-WITHDRAWAL] 📡 Step 1: Calling CPAY auth endpoint...');
    
    const authResponse = await fetch('https://api.cpay.world/api/public/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publicKey: CPAY_API_PUBLIC_KEY,
        privateKey: CPAY_API_PRIVATE_KEY,
      }),
    });

    const authResponseText = await authResponse.text();
    console.log('[CPAY-WITHDRAWAL] Auth response status:', authResponse.status);
    console.log('[CPAY-WITHDRAWAL] Auth response body:', authResponseText);

    if (!authResponse.ok) {
      const errorMsg = authResponse.status === 401 || authResponse.status === 403
        ? 'Invalid CPAY API credentials (check publicKey/privateKey)'
        : `CPAY authentication failed (${authResponse.status}): ${authResponseText}`;
      console.error('[CPAY-WITHDRAWAL] ❌ Auth failed:', errorMsg);
      throw new Error(errorMsg);
    }

    let authData;
    try {
      authData = JSON.parse(authResponseText);
    } catch (e) {
      throw new Error(`CPAY auth response is not valid JSON: ${authResponseText}`);
    }

    const bearerToken = authData.token || authData.access_token || authData.jwt;

    if (!bearerToken) {
      console.error('[CPAY-WITHDRAWAL] ❌ No token in auth response:', authData);
      throw new Error('CPAY auth response missing token field');
    }

    console.log('[CPAY-WITHDRAWAL] ✅ Authentication successful, token received');

    // Step 2: Perform withdrawal using Bearer token
    console.log('[CPAY-WITHDRAWAL] 📡 Step 2: Calling CPAY withdrawal endpoint...');

    const withdrawalPayload = {
      walletId: CPAY_WALLET_ID,
      walletPassphrase: CPAY_WALLET_PASSPHRASE,
      address: withdrawal.payout_address,
      amount: withdrawal.net_amount.toString(),
      currencyToken: 'USDT',
    };

    console.log('[CPAY-WITHDRAWAL] Withdrawal payload:', {
      ...withdrawalPayload,
      walletPassphrase: '***REDACTED***'
    });

    const withdrawalResponse = await fetch('https://api.cpay.world/api/public/withdrawal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bearerToken}`,
        'Idempotency-Key': withdrawal.id,
      },
      body: JSON.stringify(withdrawalPayload),
    });

    const responseText = await withdrawalResponse.text();
    console.log('[CPAY-WITHDRAWAL] Withdrawal response status:', withdrawalResponse.status);
    console.log('[CPAY-WITHDRAWAL] Withdrawal response body:', responseText);

    if (!withdrawalResponse.ok) {
      const errorMsg = withdrawalResponse.status === 401 || withdrawalResponse.status === 403
        ? 'Invalid CPAY wallet credentials (check walletId/walletPassphrase)'
        : withdrawalResponse.status === 400
        ? `CPAY withdrawal rejected: ${responseText} (check address/amount/balance)`
        : `CPAY withdrawal failed (${withdrawalResponse.status}): ${responseText}`;
      console.error('[CPAY-WITHDRAWAL] ❌ Withdrawal failed:', errorMsg);
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
