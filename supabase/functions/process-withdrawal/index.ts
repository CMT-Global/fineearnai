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

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { withdrawalRequestId, action, rejectionReason } = await req.json();

    console.log('Processing withdrawal:', { withdrawalRequestId, action, adminId: user.id });

    // Get withdrawal request
    const { data: withdrawalRequest, error: requestError } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', withdrawalRequestId)
      .single();

    if (requestError || !withdrawalRequest) {
      console.error('Withdrawal request not found:', requestError);
      return new Response(JSON.stringify({ error: 'Withdrawal request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Idempotency check - prevent double processing
    if (withdrawalRequest.status !== 'pending') {
      console.warn('Withdrawal already processed:', { 
        withdrawalRequestId, 
        currentStatus: withdrawalRequest.status,
        adminId: user.id 
      });
      
      return new Response(
        JSON.stringify({ 
          error: `Withdrawal request is already ${withdrawalRequest.status}`,
          current_status: withdrawalRequest.status,
          processed_at: withdrawalRequest.processed_at,
          processed_by: withdrawalRequest.processed_by
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (action === 'reject') {
      // Reject withdrawal - refund to earnings wallet
      const { data: profile } = await supabase
        .from('profiles')
        .select('earnings_wallet_balance')
        .eq('id', withdrawalRequest.user_id)
        .single();

      if (!profile) {
        return new Response(JSON.stringify({ error: 'User profile not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const newBalance = parseFloat(profile.earnings_wallet_balance) + parseFloat(withdrawalRequest.amount);

      // Update profile balance
      await supabase
        .from('profiles')
        .update({ earnings_wallet_balance: newBalance })
        .eq('id', withdrawalRequest.user_id);

      // Update withdrawal request
      await supabase
        .from('withdrawal_requests')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason || 'Rejected by admin',
          processed_by: user.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', withdrawalRequestId);

      // Update transaction status using proper JSON filtering
      await supabase
        .from('transactions')
        .update({ status: 'cancelled' })
        .contains('metadata', { withdrawal_request_id: withdrawalRequestId });

      // Create refund transaction
      await supabase
        .from('transactions')
        .insert({
          user_id: withdrawalRequest.user_id,
          type: 'adjustment',
          amount: withdrawalRequest.amount,
          wallet_type: 'earnings',
          new_balance: newBalance,
          description: `Withdrawal refund: ${rejectionReason || 'Rejected by admin'}`,
          status: 'completed',
          metadata: {
            withdrawal_request_id: withdrawalRequestId,
            reason: rejectionReason,
          },
        });

      console.log('Withdrawal rejected and refunded:', { withdrawalRequestId });

      // Audit log for rejection
      await supabase.from('audit_logs').insert({
        admin_id: user.id,
        action_type: 'withdrawal_reject',
        target_user_id: withdrawalRequest.user_id,
        details: {
          withdrawal_id: withdrawalRequestId,
          amount: withdrawalRequest.amount,
          payment_method: withdrawalRequest.payment_method,
          rejection_reason: rejectionReason || 'Rejected by admin',
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Withdrawal request rejected and refunded',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (action === 'approve') {
      // Update withdrawal request to processing
      await supabase
        .from('withdrawal_requests')
        .update({
          status: 'processing',
          processed_by: user.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', withdrawalRequestId);

      // Get Payeer credentials
      const PAYEER_API_ID = Deno.env.get('PAYEER_API_ID');
      const PAYEER_API_KEY = Deno.env.get('PAYEER_API_KEY');
      const PAYEER_ACCOUNT = Deno.env.get('PAYEER_ACCOUNT');

      if (!PAYEER_API_ID || !PAYEER_API_KEY || !PAYEER_ACCOUNT) {
        console.warn('Payeer credentials not configured - marking as completed without payment');
        
        // Mark as completed (manual processing required)
        await supabase
          .from('withdrawal_requests')
          .update({
            status: 'completed',
            payment_processor_id: 'manual-processing',
          })
          .eq('id', withdrawalRequestId);

        await supabase
          .from('transactions')
          .update({ 
            status: 'completed',
            metadata: { 
              ...withdrawalRequest.metadata,
              note: 'Manual processing required - Payeer not configured' 
            }
          })
          .contains('metadata', { withdrawal_request_id: withdrawalRequestId });

        // Audit log for manual approval
        await supabase.from('audit_logs').insert({
          admin_id: user.id,
          action_type: 'withdrawal_approve',
          target_user_id: withdrawalRequest.user_id,
          details: {
            withdrawal_id: withdrawalRequestId,
            amount: withdrawalRequest.amount,
            payment_method: withdrawalRequest.payment_method,
            payment_processor_id: 'manual-processing',
            note: 'Manual processing required - Payeer not configured',
          },
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Withdrawal approved. Manual processing required (Payeer not configured).',
            paymentProcessorId: 'manual-processing',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Process payment via Payeer API with proper signature
      try {
        console.log('Initiating Payeer payout:', {
          withdrawalRequestId,
          netAmount: withdrawalRequest.net_amount,
          payoutAddress: withdrawalRequest.payout_address
        });

        // Generate SHA256 signature for Payeer API
        // Format: account:apiId:apiPass:to:sum:curIn:curOut:comment
        const signString = `${PAYEER_ACCOUNT}:${PAYEER_API_ID}:${PAYEER_API_KEY}:${withdrawalRequest.payout_address}:${withdrawalRequest.net_amount}:USD:USD:Withdrawal ${withdrawalRequestId}`;
        
        const encoder = new TextEncoder();
        const data = encoder.encode(signString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        console.log('Generated Payeer signature for withdrawal:', withdrawalRequestId);

        // Prepare Payeer API payload with all required fields
        const payeerPayload = {
          account: PAYEER_ACCOUNT,
          apiId: PAYEER_API_ID,
          apiPass: PAYEER_API_KEY,
          action: 'output',
          ps: '1136053', // USDT TRC20 payment system ID
          sumIn: withdrawalRequest.net_amount.toString(),
          curIn: 'USD',
          curOut: 'USD',
          to: withdrawalRequest.payout_address,
          comment: `Withdrawal ${withdrawalRequestId}`,
          sign: signature,
        };

        const payeerResponse = await fetch('https://payeer.com/api/api.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payeerPayload),
        });

        const payeerResult = await payeerResponse.json();
        
        console.log('Payeer API response:', { 
          withdrawalRequestId, 
          success: !payeerResult.errors,
          historyId: payeerResult.historyId 
        });

        if (payeerResult.errors && payeerResult.errors.length > 0) {
          throw new Error(`Payeer API error: ${payeerResult.errors.join(', ')}`);
        }

        if (!payeerResult.historyId) {
          throw new Error('Payeer did not return transaction ID');
        }

        // Payment successful
        await supabase
          .from('withdrawal_requests')
          .update({
            status: 'completed',
            payment_processor_id: payeerResult.historyId || 'unknown',
          })
          .eq('id', withdrawalRequestId);

        await supabase
          .from('transactions')
          .update({ 
            status: 'completed',
            gateway_transaction_id: payeerResult.historyId 
          })
          .contains('metadata', { withdrawal_request_id: withdrawalRequestId });

        console.log('Withdrawal processed successfully via Payeer:', { 
          withdrawalRequestId,
          paymentProcessorId: payeerResult.historyId 
        });

        // Audit log for approval
        await supabase.from('audit_logs').insert({
          admin_id: user.id,
          action_type: 'withdrawal_approve',
          target_user_id: withdrawalRequest.user_id,
          details: {
            withdrawal_id: withdrawalRequestId,
            amount: withdrawalRequest.amount,
            net_amount: withdrawalRequest.net_amount,
            payment_method: withdrawalRequest.payment_method,
            payment_processor_id: payeerResult.historyId,
          },
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Withdrawal processed successfully',
            paymentProcessorId: payeerResult.historyId,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (payeerError) {
        console.error('Payeer API error:', payeerError);

        // Mark as failed
        await supabase
          .from('withdrawal_requests')
          .update({
            status: 'failed',
            rejection_reason: `Payment failed: ${payeerError instanceof Error ? payeerError.message : 'Unknown error'}`,
          })
          .eq('id', withdrawalRequestId);

        await supabase
          .from('transactions')
          .update({ status: 'failed' })
          .contains('metadata', { withdrawal_request_id: withdrawalRequestId });

        return new Response(
          JSON.stringify({
            error: 'Payment processing failed',
            details: payeerError instanceof Error ? payeerError.message : 'Unknown error',
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in process-withdrawal function:', error);
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
