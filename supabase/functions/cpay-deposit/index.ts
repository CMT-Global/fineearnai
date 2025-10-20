import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DepositRequest {
  amount: number;
  currency?: string;
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

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { amount, currency = 'USDT' }: DepositRequest = await req.json();

    if (!amount || amount <= 0) {
      throw new Error('Invalid amount');
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, username')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new Error('Failed to fetch user profile');
    }

    // Create payment request with CPAY
    const paymentData = {
      account: cpayAccountId,
      amount: amount.toString(),
      currency: currency,
      order_id: `DEP-${user.id}-${Date.now()}`,
      description: `Deposit for ${profile.username}`,
      success_url: `${Deno.env.get('VITE_SUPABASE_URL')}/wallet?deposit=success`,
      fail_url: `${Deno.env.get('VITE_SUPABASE_URL')}/wallet?deposit=failed`,
      callback_url: `${supabaseUrl}/functions/v1/cpay-webhook`,
    };

    // Sign the request
    const signString = Object.keys(paymentData)
      .sort()
      .map(key => `${key}=${paymentData[key as keyof typeof paymentData]}`)
      .join('&') + cpayPrivateKey;

    const encoder = new TextEncoder();
    const data = encoder.encode(signString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Make API request to CPAY
    const cpayResponse = await fetch('https://api.cpay.com/v1/payment/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': cpayPublicKey,
      },
      body: JSON.stringify({
        ...paymentData,
        signature,
      }),
    });

    const cpayResult = await cpayResponse.json();

    if (!cpayResponse.ok || cpayResult.status !== 'success') {
      console.error('CPAY API Error:', cpayResult);
      throw new Error(cpayResult.message || 'Payment creation failed');
    }

    // Log the deposit initiation
    await supabase.from('transactions').insert({
      user_id: user.id,
      type: 'deposit',
      amount: amount,
      wallet_type: 'deposit',
      status: 'pending',
      payment_gateway: 'cpay',
      gateway_transaction_id: cpayResult.data.payment_id,
      new_balance: 0, // Will be updated on webhook
      description: 'CPAY deposit initiated',
      metadata: {
        order_id: paymentData.order_id,
        currency: currency,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        payment_url: cpayResult.data.payment_url,
        payment_id: cpayResult.data.payment_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cpay-deposit:', error);
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
