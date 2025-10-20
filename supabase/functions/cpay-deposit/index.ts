import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DepositRequest {
  amount: number;
  currency?: string;
  processorId?: string;
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

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { amount, currency = 'USDT', processorId }: DepositRequest = await req.json();

    if (!amount || amount <= 0) {
      throw new Error('Invalid amount');
    }

    console.log(`Processing deposit request: User ${user.id}, Amount ${amount} ${currency}, ProcessorId: ${processorId || 'auto'}`);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, username, deposit_wallet_balance')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      throw new Error('Failed to fetch user profile');
    }

    // Find an active CPAY checkout for the requested currency
    let checkout = null;

    // If processorId provided, try to load processor-bound checkout
    if (processorId) {
      const { data: processor, error: procError } = await supabase
        .from('payment_processors')
        .select('*')
        .eq('id', processorId)
        .single();

      if (procError) {
        console.error('Failed to load processor:', procError);
        throw new Error('Invalid payment processor');
      }

      // Extract cpay_checkout_id from config
      const checkoutId = processor.config?.cpay_checkout_id;
      if (!checkoutId) {
        console.error('Processor has no cpay_checkout_id in config');
        throw new Error('Payment processor not properly configured');
      }

      // Load the specific checkout
      const { data: boundCheckout, error: boundError } = await supabase
        .from('cpay_checkouts')
        .select('*')
        .eq('id', checkoutId)
        .single();

      if (boundError || !boundCheckout) {
        console.error('Bound checkout not found:', boundError);
        throw new Error('Configured checkout not found');
      }

      // Verify checkout is active and amount is within limits
      if (!boundCheckout.is_active) {
        throw new Error('Selected checkout is not active');
      }

      if (amount < boundCheckout.min_amount || amount > boundCheckout.max_amount) {
        throw new Error(`Amount must be between ${boundCheckout.min_amount} and ${boundCheckout.max_amount} ${boundCheckout.currency}`);
      }

      checkout = boundCheckout;
      console.log(`Using processor-bound checkout: ${checkout.id} (${checkout.currency})`);
    } else {
      // Fallback: Find an active CPAY checkout based on currency and amount (auto-select)
      const { data: autoCheckout, error: checkoutError } = await supabase
        .from('cpay_checkouts')
        .select('*')
        .eq('currency', currency)
        .eq('is_active', true)
        .gte('max_amount', amount)
        .lte('min_amount', amount)
        .limit(1)
        .single();

      if (checkoutError || !autoCheckout) {
        console.error('No active checkout found for currency:', currency, checkoutError);
        throw new Error(`No active checkout available for ${currency}. Please contact support.`);
      }

      checkout = autoCheckout;
      console.log(`Auto-selected checkout: ${checkout.id} (${checkout.currency})`);
    }

    if (!checkout) {
      throw new Error('No suitable checkout found');
    }

    // Generate unique order_id for tracking
    const orderId = `DEP-${user.id.substring(0, 8)}-${Date.now()}`;

    console.log(`Using checkout ${checkout.checkout_id} for order ${orderId}`);

    // Create pending transaction in database
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'deposit',
        amount: amount,
        wallet_type: 'deposit',
        status: 'pending',
        payment_gateway: 'cpay',
        gateway_transaction_id: orderId, // Use order_id as transaction_id for now
        new_balance: profile.deposit_wallet_balance,
        description: `CPAY ${currency} deposit via ${checkout.checkout_id}`,
        metadata: {
          order_id: orderId,
          currency: currency,
          checkout_id: checkout.checkout_id,
          checkout_url: checkout.checkout_url,
          initiated_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (txError) {
      console.error('Transaction creation error:', txError);
      throw new Error('Failed to create transaction record');
    }

    // Build checkout URL with order_id and amount as query parameters
    const checkoutUrl = new URL(checkout.checkout_url);
    checkoutUrl.searchParams.set('order_id', orderId);
    checkoutUrl.searchParams.set('amount', amount.toString());
    checkoutUrl.searchParams.set('user_id', user.id);

    console.log(`✅ Deposit initiated: Transaction ${transaction.id}, Order ${orderId}`);

    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: checkoutUrl.toString(),
        order_id: orderId,
        transaction_id: transaction.id,
        currency: currency,
        amount: amount,
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
