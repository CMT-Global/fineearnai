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

    console.log(`Processing webhook: Order ${order_id}, Payment ${payment_id}, Status ${status}`);

    // Find the transaction by order_id (stored in gateway_transaction_id)
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*, profiles!inner(id, deposit_wallet_balance)')
      .eq('gateway_transaction_id', order_id)
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

      // Update transaction status with payment_id
      await supabase
        .from('transactions')
        .update({
          status: 'completed',
          new_balance: newBalance,
          metadata: {
            ...transaction.metadata,
            webhook_received_at: new Date().toISOString(),
            cpay_status: status,
            cpay_payment_id: payment_id,
          },
        })
        .eq('id', transaction.id);

      console.log(`✅ Deposit completed for user ${transaction.profiles.id}: ${amount} ${currency}`);

      // Send success notification
      await supabase.functions.invoke('send-cpay-notification', {
        body: {
          user_id: transaction.profiles.id,
          type: 'deposit_success',
          data: {
            amount: parseFloat(amount),
            currency,
            transaction_id: payment_id,
          },
        },
      });

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

      // Send failure notification
      await supabase.functions.invoke('send-cpay-notification', {
        body: {
          user_id: transaction.profiles.id,
          type: 'deposit_failed',
          data: {
            amount: parseFloat(amount),
            currency,
            transaction_id: payment_id,
          },
        },
      });
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
