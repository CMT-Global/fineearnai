import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const authHeader = req.headers.get('Authorization');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const { amount, paymentMethod, gatewayTransactionId } = await req.json();
    console.log('Processing deposit:', {
      userId: user.id,
      amount,
      paymentMethod
    });
    // Validate amount
    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({
        error: 'Invalid deposit amount'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get user profile
    const { data: profile, error: profileError } = await supabase.from('profiles').select('*, membership_plan').eq('id', user.id).single();
    if (profileError || !profile) {
      console.error('Profile not found:', profileError);
      return new Response(JSON.stringify({
        error: 'Profile not found'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const depositAmount = parseFloat(amount);
    // Generate tracking and payment IDs for idempotency and audit trail
    const trackingId = gatewayTransactionId || `DEP-manual-${Date.now()}`;
    const paymentId = gatewayTransactionId || `manual-${Date.now()}`;
    // ============================================================================
    // PHASE 4: TWO-STEP FLOW (Deposit First, Then Commission)
    // ============================================================================
    console.log('[DEPOSIT-V3] Starting two-step deposit flow:', {
      userId: user.id,
      amount: depositAmount,
      trackingId,
      paymentId
    });
    // ============================================================================
    // STEP 1: Process Deposit (CRITICAL - Must Succeed)
    // ============================================================================
    console.log('[DEPOSIT-V3] Step 1: Processing deposit ONLY...');
    const { data: depositResult, error: depositError } = await supabase.rpc('credit_deposit_simple_v3', {
      p_user_id: user.id,
      p_amount: depositAmount,
      p_tracking_id: trackingId,
      p_payment_id: paymentId,
      p_payment_method: paymentMethod,
      p_metadata: {
        deposit_via: 'direct',
        processed_at: new Date().toISOString(),
        tracking_id: trackingId,
        payment_id: paymentId
      }
    });
    if (depositError || !depositResult?.success) {
      console.error('[DEPOSIT-V3] ❌ Deposit processing failed:', depositError || depositResult);
      throw new Error('Failed to process deposit: ' + (depositError?.message || depositResult?.error));
    }
    // Check for duplicate detection
    if (depositResult.error === 'duplicate_transaction') {
      console.log('[DEPOSIT-V3] ⚠️ Duplicate transaction detected');
      return new Response(JSON.stringify({
        success: true,
        message: 'Transaction already processed',
        transaction: {
          id: depositResult.existing_transaction_id
        },
        newBalance: depositResult.new_balance || profile.deposit_wallet_balance
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
    console.log('[COMMISSION-V1] Step 2: Processing commission separately...');
    // Simple retry for commission only (2 retries max)
    const MAX_COMMISSION_RETRIES = 2;
    let commissionResult = null;
    for(let attempt = 0; attempt <= MAX_COMMISSION_RETRIES; attempt++){
      console.log(`[COMMISSION-V1] Attempt ${attempt + 1}/${MAX_COMMISSION_RETRIES + 1}`);
      const { data } = await supabase.rpc('process_deposit_commission_simple_v1', {
        p_deposit_transaction_id: depositResult.transaction_id,
        p_deposit_amount: depositAmount,
        p_depositor_id: user.id
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
      referred_id: user.id,
      commission_type: 'deposit_commission',
      status: commissionResult?.success && commissionResult?.commission_amount > 0 ? 'success' : 'failed',
      commission_amount: commissionResult?.commission_amount || 0,
      error_details: commissionResult?.success ? null : {
        reason: commissionResult?.error || commissionResult?.reason || 'Commission processing failed',
        error_code: commissionResult?.error_code || 'UNKNOWN',
        tracking_id: trackingId,
        payment_id: paymentId,
        deposit_amount: depositAmount,
        username: profile.username,
        timestamp: new Date().toISOString()
      }
    };
    const { error: auditLogError } = await supabase.from('commission_audit_log').insert(auditLogEntry);
    if (auditLogError) {
      console.warn('[COMMISSION-V1] ⚠️ Failed to insert audit log (non-critical):', auditLogError);
    } else {
      console.log('[COMMISSION-V1] ✓ Audit log created:', auditLogEntry.status);
    }
    // Store results for response
    const transaction = {
      id: depositResult.transaction_id
    };
    const newBalance = depositResult.new_balance;
    const atomicResult = {
      ...depositResult,
      commission_processed: commissionResult?.success && commissionResult?.commission_amount > 0,
      commission_amount: commissionResult?.commission_amount || 0
    };
    console.log('Deposit completed successfully:', {
      userId: user.id,
      amount: depositAmount
    });
    return new Response(JSON.stringify({
      success: true,
      transaction,
      newBalance
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in deposit function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
