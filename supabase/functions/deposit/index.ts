import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { amount, paymentMethod, gatewayTransactionId } = await req.json();

    console.log('Processing deposit:', { userId: user.id, amount, paymentMethod });

    // Validate amount
    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid deposit amount' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*, membership_plan')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found:', profileError);
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const depositAmount = parseFloat(amount);
    
    // Generate tracking and payment IDs for idempotency and audit trail
    const trackingId = gatewayTransactionId || `DEP-manual-${Date.now()}`;
    const paymentId = gatewayTransactionId || `manual-${Date.now()}`;
    
    // Check if user has upline BEFORE calling atomic function (for audit logging)
    const { data: referralCheck } = await supabase
      .from('referrals')
      .select('referrer_id, status')
      .eq('referred_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    
    const hasUpline = !!referralCheck?.referrer_id;
    const referrerId = referralCheck?.referrer_id || null;
    
    console.log(`[COMMISSION-AUDIT] User ${user.id} (${profile.username}) has upline: ${hasUpline}, referrerId: ${referrerId}`);
    
    // Use atomic deposit function for race-condition protection
    console.log('Calling atomic deposit function:', { userId: user.id, amount: depositAmount, paymentMethod, trackingId, paymentId });
    
    const { data: atomicResult, error: atomicError } = await supabase.rpc('credit_deposit_atomic_v2', {
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

    if (atomicError) {
      console.error('Atomic deposit function error:', atomicError);
      
      // Log failure to audit if user has upline
      if (hasUpline) {
        await supabase.from('commission_audit_log').insert({
          deposit_transaction_id: trackingId,
          referrer_id: referrerId,
          referred_id: user.id,
          commission_type: 'deposit_commission',
          status: 'failed',
          commission_amount: 0,
          error_details: {
            reason: 'deposit_function_failed',
            error_message: atomicError.message,
            tracking_id: trackingId,
            payment_id: paymentId,
            deposit_amount: depositAmount,
            username: profile.username,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      throw new Error('Failed to process deposit atomically: ' + atomicError.message);
    }

    // Check if atomic function detected duplicate or failed
    if (!atomicResult.success) {
      if (atomicResult.error === 'duplicate_transaction') {
        console.log('Duplicate transaction detected by atomic function');
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Transaction already processed',
            transaction: { id: atomicResult.transaction_id },
            newBalance: atomicResult.new_balance || profile.deposit_wallet_balance
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.error('Atomic deposit failed:', atomicResult);
      
      // Log failure to audit if user has upline
      if (hasUpline) {
        await supabase.from('commission_audit_log').insert({
          deposit_transaction_id: trackingId,
          referrer_id: referrerId,
          referred_id: user.id,
          commission_type: 'deposit_commission',
          status: 'failed',
          commission_amount: 0,
          error_details: {
            reason: 'atomic_function_returned_failure',
            error_message: atomicResult.message || 'Atomic deposit processing failed',
            error_code: atomicResult.error,
            tracking_id: trackingId,
            payment_id: paymentId,
            deposit_amount: depositAmount,
            username: profile.username,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      throw new Error(atomicResult.message || 'Atomic deposit processing failed');
    }

    console.log('Atomic deposit successful:', {
      transactionId: atomicResult.transaction_id,
      oldBalance: atomicResult.old_balance,
      newBalance: atomicResult.new_balance,
      amountCredited: atomicResult.amount_credited,
      commissionProcessed: atomicResult.commission_processed,
      commissionAmount: atomicResult.commission_amount
    });

    const transaction = { id: atomicResult.transaction_id };
    const newBalance = atomicResult.new_balance;

    // ============================================================================
    // COMMISSION AUDIT LOGGING (matching CPAY webhook pattern)
    // ============================================================================
    const auditLogEntry = {
      deposit_transaction_id: atomicResult.transaction_id,
      referrer_id: referrerId,
      referred_id: user.id,
      commission_type: 'deposit_commission',
      status: atomicResult.commission_processed ? 'success' : 'failed',
      commission_amount: atomicResult.commission_amount || 0,
      error_details: atomicResult.commission_processed ? null : {
        reason: 'Commission not processed by atomic function',
        tracking_id: trackingId,
        payment_id: paymentId,
        has_upline: hasUpline,
        username: profile.username,
        deposit_amount: depositAmount,
        timestamp: new Date().toISOString()
      }
    };
    
    const { error: auditLogError } = await supabase
      .from('commission_audit_log')
      .insert(auditLogEntry);
    
    if (auditLogError) {
      console.warn('[DEPOSIT] ⚠️ Failed to insert commission audit log (non-critical):', auditLogError);
    } else {
      console.log('[DEPOSIT] ✓ Commission audit log created:', auditLogEntry.status);
    }
    
    // CRITICAL ALERT: If commission failed but user has active upline
    if (!atomicResult.commission_processed && hasUpline) {
      console.error(
        `🚨 COMMISSION FAILURE: User ${profile.username} deposited $${depositAmount} ` +
        `but commission NOT credited to upline (referrer_id: ${referrerId}). ` +
        `TrackingId: ${trackingId}, PaymentId: ${paymentId}`
      );
    }
    
    // Log success if commission was processed
    if (atomicResult.commission_processed) {
      console.log(
        `💰 COMMISSION PROCESSED: Referrer earned $${atomicResult.commission_amount} ` +
        `from deposit by ${profile.username}`
      );
    } else {
      console.log('[DEPOSIT] ℹ️ No commission processed (user has no active referrer or commission rate is 0)');
    }

    console.log('Deposit completed successfully:', { userId: user.id, amount: depositAmount });

    return new Response(
      JSON.stringify({
        success: true,
        transaction,
        newBalance,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in deposit function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
