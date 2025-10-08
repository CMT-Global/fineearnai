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

    if (withdrawalRequest.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: `Withdrawal request is already ${withdrawalRequest.status}` }),
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

      // Update transaction status
      await supabase
        .from('transactions')
        .update({ status: 'cancelled' })
        .eq('metadata->>withdrawal_request_id', withdrawalRequestId);

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
          .eq('metadata->>withdrawal_request_id', withdrawalRequestId);

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

      // Process payment via Payeer API
      try {
        const payeerPayload = {
          api_id: PAYEER_API_ID,
          api_pass: PAYEER_API_KEY,
          account: PAYEER_ACCOUNT,
          to: withdrawalRequest.payout_address,
          sum: withdrawalRequest.net_amount.toString(),
          curIn: 'USD',
          curOut: 'USD',
          comment: `Withdrawal ${withdrawalRequestId}`,
        };

        const payeerResponse = await fetch('https://payeer.com/ajax/api/api.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(payeerPayload as any),
        });

        const payeerResult = await payeerResponse.json();

        if (payeerResult.errors && payeerResult.errors.length > 0) {
          throw new Error(payeerResult.errors.join(', '));
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
          .eq('metadata->>withdrawal_request_id', withdrawalRequestId);

        console.log('Withdrawal processed successfully via Payeer:', { 
          withdrawalRequestId,
          paymentProcessorId: payeerResult.historyId 
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
          .eq('metadata->>withdrawal_request_id', withdrawalRequestId);

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
