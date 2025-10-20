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

    console.log(`[CPAY-DEPOSIT] User: ${user.id}, Amount: ${amount} ${currency}, ProcessorId: ${processorId || 'auto'}`);

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
    let hasCheckoutBinding = false;

    // If processorId provided, try to load processor-bound checkout
    if (processorId) {
      console.log(`[CPAY-DEPOSIT] Loading processor ${processorId}`);
      const { data: processor, error: procError } = await supabase
        .from('payment_processors')
        .select('*')
        .eq('id', processorId)
        .single();

      if (procError) {
        console.error('[CPAY-DEPOSIT] Failed to load processor:', procError);
        throw new Error('Invalid payment processor');
      }

      // Extract cpay_checkout_id from config
      const checkoutId = processor.config?.cpay_checkout_id;
      
      if (!checkoutId) {
        console.warn(`[CPAY-DEPOSIT] Processor ${processorId} has no cpay_checkout_id. Falling back to auto-select.`);
        // FALL BACK to auto-select instead of erroring
      } else {
        hasCheckoutBinding = true;
        console.log(`[CPAY-DEPOSIT] Processor has binding to checkout ${checkoutId}`);
        
        // Load the specific checkout
        const { data: boundCheckout, error: boundError } = await supabase
          .from('cpay_checkouts')
          .select('*')
          .eq('id', checkoutId)
          .single();

        if (boundError || !boundCheckout) {
          console.error('[CPAY-DEPOSIT] Bound checkout not found:', boundError);
          throw new Error('Configured checkout not found. Please contact support.');
        }

        // Verify checkout is active
        if (!boundCheckout.is_active) {
          throw new Error('Selected checkout is currently inactive. Please contact support.');
        }

        // Verify amount is within limits
        if (amount < boundCheckout.min_amount || amount > boundCheckout.max_amount) {
          throw new Error(`Amount must be between $${boundCheckout.min_amount} and $${boundCheckout.max_amount} for ${boundCheckout.currency}`);
        }

        checkout = boundCheckout;
        console.log(`[CPAY-DEPOSIT] Using processor-bound checkout: ${checkout.id} (${checkout.currency})`);
      }
    }
    
    // Auto-select if no processorId or processor had no binding
    if (!checkout) {
      console.log(`[CPAY-DEPOSIT] Auto-selecting checkout for ${currency}, amount ${amount}`);
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
        console.error('[CPAY-DEPOSIT] No active checkout found for currency:', currency, checkoutError);
        throw new Error(
          `No active CPAY checkout matches currency ${currency} and amount $${amount}. ` +
          `Please configure a checkout in Admin > CPAY Checkouts, or update processor binding.`
        );
      }

      checkout = autoCheckout;
      console.log(`[CPAY-DEPOSIT] Auto-selected checkout: ${checkout.id} (${checkout.currency})`);
    }

    if (!checkout) {
      throw new Error('No suitable checkout found');
    }

    // Generate unique order_id for tracking
    const orderId = `DEP-${user.id.substring(0, 8)}-${Date.now()}`;

    console.log(`[CPAY-DEPOSIT] ✓ Checkout selected: ${checkout.checkout_id}, Order: ${orderId}, Has binding: ${hasCheckoutBinding}`);

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

    console.log(`[CPAY-DEPOSIT] ✅ SUCCESS: Transaction ${transaction.id}, Order ${orderId}, Checkout ${checkout.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: checkoutUrl.toString(),
        order_id: orderId,
        transaction_id: transaction.id,
        currency: currency,
        amount: amount,
        checkout_id: checkout.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CPAY-DEPOSIT] ❌ ERROR:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred during deposit processing' 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
