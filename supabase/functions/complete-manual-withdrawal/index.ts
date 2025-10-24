import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompleteRequest {
  withdrawal_request_id: string;
  transaction_hash: string;
  notes?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user (must be admin)
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roles) {
      throw new Error('Admin access required');
    }

    const { withdrawal_request_id, transaction_hash, notes }: CompleteRequest = await req.json();

    // Validate transaction hash
    if (!transaction_hash || transaction_hash.trim().length === 0) {
      throw new Error('Transaction hash is required');
    }

    // Get withdrawal request
    const { data: withdrawal, error: withdrawalError } = await supabase
      .from('withdrawal_requests')
      .select(`
        *,
        profiles:user_id (
          email,
          username,
          earnings_wallet_balance
        )
      `)
      .eq('id', withdrawal_request_id)
      .single();

    if (withdrawalError || !withdrawal) {
      throw new Error('Withdrawal request not found');
    }

    if (withdrawal.status !== 'approved_manual') {
      throw new Error(`Cannot complete withdrawal with status: ${withdrawal.status}. Only 'approved_manual' withdrawals can be completed.`);
    }

    console.log('Completing manual withdrawal:', {
      withdrawalRequestId: withdrawal_request_id,
      userId: withdrawal.user_id,
      transactionHash: transaction_hash,
      amount: withdrawal.net_amount
    });

    const completedAt = new Date().toISOString();

    // Update withdrawal request to 'completed'
    await supabase
      .from('withdrawal_requests')
      .update({
        status: 'completed',
        manual_txn_hash: transaction_hash,
        admin_notes: notes ? `${withdrawal.admin_notes || ''}\n\nCompletion notes: ${notes}` : withdrawal.admin_notes,
        processed_at: completedAt,
      })
      .eq('id', withdrawal_request_id);

    // Update transaction record to 'completed'
    await supabase
      .from('transactions')
      .update({
        status: 'completed',
        gateway_transaction_id: transaction_hash,
        description: 'Manual crypto transfer completed',
      })
      .eq('user_id', withdrawal.user_id)
      .eq('metadata->>withdrawal_request_id', withdrawal_request_id)
      .eq('status', 'pending_manual');

    // Get tracking record to calculate processing time
    const { data: trackingRecord } = await supabase
      .from('manual_withdrawal_tracking')
      .select('approved_at')
      .eq('withdrawal_request_id', withdrawal_request_id)
      .single();

    // Calculate processing time in minutes
    let processingTimeMinutes = null;
    if (trackingRecord?.approved_at) {
      const approvedTime = new Date(trackingRecord.approved_at);
      const completedTime = new Date(completedAt);
      processingTimeMinutes = Math.round((completedTime.getTime() - approvedTime.getTime()) / (1000 * 60));
    }

    // Update tracking record with completion details
    await supabase
      .from('manual_withdrawal_tracking')
      .update({
        completed_at: completedAt,
        blockchain_txn_hash: transaction_hash,
        processing_time_minutes: processingTimeMinutes,
        notes: notes ? `${trackingRecord ? 'Approved for manual processing. ' : ''}Completion notes: ${notes}` : undefined,
      })
      .eq('withdrawal_request_id', withdrawal_request_id);

    console.log('Manual withdrawal tracking updated:', {
      withdrawalRequestId: withdrawal_request_id,
      processingTimeMinutes,
      completedAt
    });

    // Send completion notification to user
    await supabase.functions.invoke('send-cpay-notification', {
      body: {
        user_id: withdrawal.user_id,
        type: 'withdrawal_completed',
        data: {
          amount: withdrawal.net_amount,
          currency: 'USDT',
          payout_address: withdrawal.payout_address,
          transaction_hash: transaction_hash,
          note: 'Your withdrawal has been sent. Please check your wallet.',
        },
      },
    });

    // Audit log for completion
    await supabase.from('audit_logs').insert({
      admin_id: user.id,
      action_type: 'withdrawal_complete_manual',
      target_user_id: withdrawal.user_id,
      details: {
        withdrawal_id: withdrawal_request_id,
        amount: withdrawal.amount,
        net_amount: withdrawal.net_amount,
        payment_method: withdrawal.payment_method,
        transaction_hash: transaction_hash,
        completion_notes: notes,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Withdrawal marked as completed successfully',
        transaction_hash: transaction_hash,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in complete-manual-withdrawal:', error);
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
