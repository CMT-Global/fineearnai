import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WithdrawRequest {
  withdrawal_request_id: string;
  action: 'approve' | 'reject';
  rejection_reason?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const cpayPublicKey = Deno.env.get('CPAY_API_PUBLIC_KEY')!;
    const cpayPrivateKey = Deno.env.get('CPAY_API_PRIVATE_KEY')!;
    const cpayAccountId = Deno.env.get('CPAY_ACCOUNT_ID')!;

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

    const { withdrawal_request_id, action, rejection_reason }: WithdrawRequest = await req.json();

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

    if (withdrawal.status !== 'pending') {
      throw new Error('Withdrawal request already processed');
    }

    // Handle rejection
    if (action === 'reject') {
      if (!rejection_reason) {
        throw new Error('Rejection reason is required');
      }

      // Refund to user's earnings wallet
      const { error: refundError } = await supabase
        .from('profiles')
        .update({
          earnings_wallet_balance: withdrawal.profiles.earnings_wallet_balance + withdrawal.amount,
        })
        .eq('id', withdrawal.user_id);

      if (refundError) {
        throw new Error('Failed to refund withdrawal');
      }

      // Update withdrawal request
      await supabase
        .from('withdrawal_requests')
        .update({
          status: 'rejected',
          rejection_reason,
          processed_by: user.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', withdrawal_request_id);

      // Create transaction record
      await supabase.from('transactions').insert({
        user_id: withdrawal.user_id,
        type: 'withdrawal',
        amount: withdrawal.amount,
        wallet_type: 'earnings',
        status: 'failed',
        payment_gateway: 'cpay',
        new_balance: withdrawal.profiles.earnings_wallet_balance + withdrawal.amount,
        description: `Withdrawal rejected: ${rejection_reason}`,
        metadata: {
          withdrawal_request_id,
          rejection_reason,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Withdrawal rejected and funds refunded',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle approval - Process payout via CPAY
    const payoutData = {
      account: cpayAccountId,
      amount: withdrawal.net_amount.toString(),
      currency: 'USDT',
      address: withdrawal.payout_address,
      network: 'TRC20',
      order_id: `WD-${withdrawal.id}-${Date.now()}`,
    };

    // Sign the request
    const signString = Object.keys(payoutData)
      .sort()
      .map(key => `${key}=${payoutData[key as keyof typeof payoutData]}`)
      .join('&') + cpayPrivateKey;

    const encoder = new TextEncoder();
    const data = encoder.encode(signString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Make API request to CPAY for payout
    const cpayResponse = await fetch('https://api.cpay.com/v1/payout/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': cpayPublicKey,
      },
      body: JSON.stringify({
        ...payoutData,
        signature,
      }),
    });

    const cpayResult = await cpayResponse.json();

    if (!cpayResponse.ok || cpayResult.status !== 'success') {
      console.error('CPAY Payout Error:', cpayResult);
      
      // Mark as failed but don't refund yet (manual review needed)
      await supabase
        .from('withdrawal_requests')
        .update({
          status: 'failed',
          rejection_reason: cpayResult.message || 'Payout failed',
          processed_by: user.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', withdrawal_request_id);

      throw new Error(cpayResult.message || 'Payout creation failed');
    }

    // Update withdrawal request as completed
    await supabase
      .from('withdrawal_requests')
      .update({
        status: 'completed',
        processed_by: user.id,
        processed_at: new Date().toISOString(),
      })
      .eq('id', withdrawal_request_id);

    // Create transaction record
    const { data: profile } = await supabase
      .from('profiles')
      .select('earnings_wallet_balance')
      .eq('id', withdrawal.user_id)
      .single();

    await supabase.from('transactions').insert({
      user_id: withdrawal.user_id,
      type: 'withdrawal',
      amount: withdrawal.amount,
      wallet_type: 'earnings',
      status: 'completed',
      payment_gateway: 'cpay',
      gateway_transaction_id: cpayResult.data.payout_id,
      new_balance: profile?.earnings_wallet_balance || 0,
      description: 'CPAY withdrawal completed',
      metadata: {
        withdrawal_request_id,
        payout_id: cpayResult.data.payout_id,
        order_id: payoutData.order_id,
        net_amount: withdrawal.net_amount,
        fee: withdrawal.fee,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Withdrawal processed successfully',
        payout_id: cpayResult.data.payout_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cpay-withdraw:', error);
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
