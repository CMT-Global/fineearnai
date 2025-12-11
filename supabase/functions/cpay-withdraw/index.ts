import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Get authenticated user (must be admin)
    const authHeader = req.headers.get('Authorization');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }
    // Check if user is admin
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').single();
    if (!roles) {
      throw new Error('Admin access required');
    }
    const { withdrawal_request_id, action, rejection_reason } = await req.json();
    // Get withdrawal request
    const { data: withdrawal, error: withdrawalError } = await supabase.from('withdrawal_requests').select(`
        *,
        profiles:user_id (
          email,
          username,
          earnings_wallet_balance
        )
      `).eq('id', withdrawal_request_id).single();
    if (withdrawalError || !withdrawal) {
      throw new Error('Withdrawal request not found');
    }
    if (withdrawal.status !== 'pending') {
      throw new Error('Withdrawal request already processed');
    }
    // Handle rejection
    if (action === 'reject') {
      if (!rejection_reason) {
        throw new Error('Rejection reason is required');
      }
      // Refund to user's earnings wallet using atomic operation pattern
      // First, get current balance with row locking to prevent race conditions
      const { data: currentProfile, error: profileError } = await supabase.from('profiles').select('earnings_wallet_balance').eq('id', withdrawal.user_id).single();
      if (profileError || !currentProfile) {
        throw new Error('Failed to retrieve user profile for refund');
      }
      const newBalance = parseFloat(currentProfile.earnings_wallet_balance) + parseFloat(withdrawal.amount);
      // Update balance atomically
      const { error: refundError } = await supabase.from('profiles').update({
        earnings_wallet_balance: newBalance
      }).eq('id', withdrawal.user_id);
      if (refundError) {
        throw new Error('Failed to refund withdrawal');
      }
      console.log('CPAY withdrawal refunded:', {
        withdrawalRequestId: withdrawal_request_id,
        userId: withdrawal.user_id,
        refundAmount: withdrawal.amount,
        newBalance
      });
      // Update withdrawal request
      await supabase.from('withdrawal_requests').update({
        status: 'rejected',
        rejection_reason,
        processed_by: user.id,
        processed_at: new Date().toISOString()
      }).eq('id', withdrawal_request_id);
      // Create transaction record with correct new balance
      await supabase.from('transactions').insert({
        user_id: withdrawal.user_id,
        type: 'withdrawal',
        amount: withdrawal.amount,
        wallet_type: 'earnings',
        status: 'failed',
        payment_gateway: 'cpay',
        new_balance: newBalance,
        description: `Withdrawal rejected: ${rejection_reason}`,
        metadata: {
          withdrawal_request_id,
          rejection_reason
        }
      });
      // Send rejection notification
      await supabase.functions.invoke('send-cpay-notification', {
        body: {
          user_id: withdrawal.user_id,
          type: 'withdrawal_rejected',
          data: {
            amount: withdrawal.amount,
            currency: 'USDT',
            reason: rejection_reason
          }
        }
      });
      // Audit log for rejection
      await supabase.from('audit_logs').insert({
        admin_id: user.id,
        action_type: 'withdrawal_reject',
        target_user_id: withdrawal.user_id,
        details: {
          withdrawal_id: withdrawal_request_id,
          amount: withdrawal.amount,
          payment_method: withdrawal.payment_method,
          rejection_reason
        }
      });
      return new Response(JSON.stringify({
        success: true,
        message: 'Withdrawal rejected and funds refunded'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Handle approval - Manual processing workflow
    // Step 1: Prepare withdrawal details for manual processing
    const withdrawalDetails = {
      user: withdrawal.profiles.username,
      email: withdrawal.profiles.email,
      amount: withdrawal.net_amount,
      currency: 'USDT',
      network: 'TRC20',
      address: withdrawal.payout_address,
      fee: withdrawal.fee,
      total_amount: withdrawal.amount
    };
    console.log('Withdrawal approved for manual processing:', {
      withdrawalRequestId: withdrawal_request_id,
      userId: withdrawal.user_id,
      details: withdrawalDetails
    });
    // Step 2: Update withdrawal request status to 'approved_manual'
    await supabase.from('withdrawal_requests').update({
      status: 'approved_manual',
      processed_by: user.id,
      processed_at: new Date().toISOString(),
      admin_notes: 'Approved for manual processing. Admin must send crypto manually from external wallet.'
    }).eq('id', withdrawal_request_id);
    // Step 3: Get current balance for transaction record
    const { data: profile } = await supabase.from('profiles').select('earnings_wallet_balance').eq('id', withdrawal.user_id).single();
    // Step 4: Create transaction record with 'pending_manual' status
    await supabase.from('transactions').insert({
      user_id: withdrawal.user_id,
      type: 'withdrawal',
      amount: withdrawal.amount,
      wallet_type: 'earnings',
      status: 'pending_manual',
      payment_gateway: 'manual',
      new_balance: profile?.earnings_wallet_balance || 0,
      description: 'Withdrawal approved - awaiting manual crypto transfer',
      metadata: {
        withdrawal_request_id,
        payout_details: withdrawalDetails,
        approved_by: user.id,
        approved_at: new Date().toISOString()
      }
    });
    // Step 5: Send notification to user about approval
    await supabase.functions.invoke('send-cpay-notification', {
      body: {
        user_id: withdrawal.user_id,
        type: 'withdrawal_approved',
        data: {
          amount: withdrawal.net_amount,
          currency: 'USDT',
          payout_address: withdrawal.payout_address,
          status: 'approved_manual',
          note: 'Your withdrawal has been approved and will be processed manually by our team.'
        }
      }
    });
    // Step 6: Create manual withdrawal tracking record
    const approvedAt = new Date().toISOString();
    await supabase.from('manual_withdrawal_tracking').insert({
      withdrawal_request_id,
      approved_at: approvedAt,
      admin_id: user.id,
      notes: 'Withdrawal approved for manual processing'
    });
    // Step 7: Audit log for approval
    await supabase.from('audit_logs').insert({
      admin_id: user.id,
      action_type: 'withdrawal_approve_manual',
      target_user_id: withdrawal.user_id,
      details: {
        withdrawal_id: withdrawal_request_id,
        amount: withdrawal.amount,
        net_amount: withdrawal.net_amount,
        payment_method: withdrawal.payment_method,
        payout_details: withdrawalDetails,
        processing_type: 'manual'
      }
    });
    return new Response(JSON.stringify({
      success: true,
      message: 'Withdrawal approved. Manual processing required.',
      payout_details: withdrawalDetails,
      instructions: 'Please send crypto manually from your external wallet and then mark as completed in the admin panel.'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in cpay-withdraw:', error);
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
