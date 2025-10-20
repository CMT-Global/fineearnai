import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const cpayPrivateKey = Deno.env.get('CPAY_API_PRIVATE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const webhookData = await req.json();
    
    console.log('CPAY Webhook received:', JSON.stringify(webhookData, null, 2));

    // Verify webhook signature
    const { signature, ...dataToVerify } = webhookData;
    const verifyString = Object.keys(dataToVerify)
      .sort()
      .map(key => `${key}=${dataToVerify[key]}`)
      .join('&') + cpayPrivateKey;

    const encoder = new TextEncoder();
    const data = encoder.encode(verifyString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature');
      throw new Error('Invalid signature');
    }

    const { order_id, payment_id, status, amount, currency } = webhookData;

    // Find the transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*, profiles!inner(id, deposit_wallet_balance)')
      .eq('gateway_transaction_id', payment_id)
      .eq('type', 'deposit')
      .single();

    if (txError || !transaction) {
      console.error('Transaction not found:', payment_id);
      throw new Error('Transaction not found');
    }

    // Handle payment status
    if (status === 'completed' || status === 'success') {
      // Update user's deposit wallet balance
      const newBalance = transaction.profiles.deposit_wallet_balance + parseFloat(amount);
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ deposit_wallet_balance: newBalance })
        .eq('id', transaction.profiles.id);

      if (updateError) {
        console.error('Failed to update balance:', updateError);
        throw new Error('Failed to update balance');
      }

      // Update transaction status
      await supabase
        .from('transactions')
        .update({
          status: 'completed',
          new_balance: newBalance,
          metadata: {
            ...transaction.metadata,
            webhook_received_at: new Date().toISOString(),
            cpay_status: status,
          },
        })
        .eq('id', transaction.id);

      console.log(`Deposit completed for user ${transaction.profiles.id}: ${amount} ${currency}`);

    } else if (status === 'failed' || status === 'cancelled' || status === 'expired') {
      // Update transaction as failed
      await supabase
        .from('transactions')
        .update({
          status: 'failed',
          metadata: {
            ...transaction.metadata,
            webhook_received_at: new Date().toISOString(),
            cpay_status: status,
          },
        })
        .eq('id', transaction.id);

      console.log(`Deposit failed for user ${transaction.profiles.id}: ${status}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cpay-webhook:', error);
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
