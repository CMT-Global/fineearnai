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
    
    // Use atomic deposit function for race-condition protection
    console.log('Calling atomic deposit function:', { userId: user.id, amount: depositAmount, paymentMethod });
    
    const { data: atomicResult, error: atomicError } = await supabase.rpc('credit_deposit_atomic', {
      p_user_id: user.id,
      p_amount: depositAmount,
      p_order_id: gatewayTransactionId || `manual-${Date.now()}`,
      p_payment_method: paymentMethod,
      p_gateway_transaction_id: gatewayTransactionId,
      p_metadata: {
        deposit_via: 'direct',
        processed_at: new Date().toISOString()
      }
    });

    if (atomicError) {
      console.error('Atomic deposit function error:', atomicError);
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
      throw new Error(atomicResult.message || 'Atomic deposit processing failed');
    }

    console.log('Atomic deposit successful:', {
      transactionId: atomicResult.transaction_id,
      oldBalance: atomicResult.old_balance,
      newBalance: atomicResult.new_balance,
      amountCredited: atomicResult.amount_credited
    });

    const transaction = { id: atomicResult.transaction_id };
    const newBalance = atomicResult.new_balance;

    // ============================================================================
    // PHASE 1: COMMISSION NOW PROCESSED ATOMICALLY IN DATABASE
    // No queue needed - commission credited instantly in same transaction
    // ============================================================================
    if (atomicResult.commission_processed) {
      console.log(`💰 Deposit commission processed atomically: $${atomicResult.commission_amount}`);
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
