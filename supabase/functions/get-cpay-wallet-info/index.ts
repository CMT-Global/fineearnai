import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

const CPAY_BASE_URL = 'https://api.cpay.world';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[GET-CPAY-WALLET-INFO] 🚀 Starting wallet info fetch...');

    // ============================================================
    // STEP 1: AUTHENTICATE USER (ADMIN ONLY)
    // ============================================================
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin');

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============================================================
    // STEP 2: GET CPAY CREDENTIALS & CHECK MODE
    // ============================================================
    const { searchParams } = new URL(req.url);
    let mode = searchParams.get('mode') || 'wallet'; // 'wallet' or 'deposit'
    
    // Also accept JSON body { mode } since frontend uses invoke with body
    if (req.method === 'POST') {
      try {
        const contentType = req.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const bodyText = await req.text();
          if (bodyText) {
            const maybeBody = JSON.parse(bodyText);
            if (maybeBody && typeof maybeBody.mode !== 'undefined') {
              mode = String(maybeBody.mode);
            }
          }
        }
      } catch (err) {
        // ignore body parse errors
        console.log('[GET-CPAY-WALLET-INFO] ⚠️ Body parse warning:', err);
      }
    }
    const CPAY_WALLET_ID = Deno.env.get('CPAY_WALLET_ID');
    const CPAY_API_PUBLIC_KEY = Deno.env.get('CPAY_API_PUBLIC_KEY');
    const CPAY_API_PRIVATE_KEY = Deno.env.get('CPAY_API_PRIVATE_KEY');
    const CPAY_WALLET_PASSPHRASE = Deno.env.get('CPAY_WALLET_PASSPHRASE');

    // Note: CPAY_ACCOUNT_ID is not used for wallet-auth flow
    if (!CPAY_WALLET_ID || !CPAY_API_PUBLIC_KEY || !CPAY_API_PRIVATE_KEY || !CPAY_WALLET_PASSPHRASE) {
      console.error('[GET-CPAY-WALLET-INFO] ❌ Missing CPAY credentials');
      return new Response(JSON.stringify({
        error: 'CPAY credentials not configured (wallet-auth requires: walletId, publicKey, privateKey, passphrase)',
        missing: {
          walletId: !CPAY_WALLET_ID,
          publicKey: !CPAY_API_PUBLIC_KEY,
          privateKey: !CPAY_API_PRIVATE_KEY,
          passphrase: !CPAY_WALLET_PASSPHRASE
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[GET-CPAY-WALLET-INFO] ✅ CPAY wallet credentials found');
    console.log('[GET-CPAY-WALLET-INFO] 💼 Wallet ID:', CPAY_WALLET_ID);

    // ============================================================
    // STEP 3: PERFORM WALLET AUTHENTICATION (using public/auth flow)
    // ============================================================
    console.log('[GET-CPAY-WALLET-INFO] 🔐 Using wallet-auth flow (same as withdrawals)...');
    
    // Step 1/2: Account authentication to mirror reliable flow
    console.log('[GET-CPAY-WALLET-INFO] 📡 Step 1/2: Account authentication...');
    const accountAuthRes = await fetch(`${CPAY_BASE_URL}/api/public/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: CPAY_API_PUBLIC_KEY,
        privateKey: CPAY_API_PRIVATE_KEY,
      })
    });
    const accountAuthText = await accountAuthRes.text();
    console.log('[GET-CPAY-WALLET-INFO] Step 1 response status:', accountAuthRes.status);
    if (!accountAuthRes.ok) {
      console.error('[GET-CPAY-WALLET-INFO] ❌ Account auth failed:', accountAuthText);
      return new Response(JSON.stringify({
        error: 'CPAY account authentication failed',
        status: accountAuthRes.status,
        details: accountAuthText
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Step 2/2: Wallet authentication with passphrase
    console.log('[GET-CPAY-WALLET-INFO] 📡 Step 2/2: Wallet authentication...');
    const walletAuthRes = await fetch(`${CPAY_BASE_URL}/api/public/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletId: CPAY_WALLET_ID,
        passphrase: CPAY_WALLET_PASSPHRASE,
        publicKey: CPAY_API_PUBLIC_KEY,
        privateKey: CPAY_API_PRIVATE_KEY,
      })
    });

    console.log('[GET-CPAY-WALLET-INFO] Step 2 response status:', walletAuthRes.status);
    if (!walletAuthRes.ok) {
      const errorText = await walletAuthRes.text();
      console.error('[GET-CPAY-WALLET-INFO] ❌ Wallet auth failed:', errorText);
      return new Response(JSON.stringify({
        error: 'CPAY wallet authentication failed',
        status: walletAuthRes.status,
        details: errorText,
        hint: 'Ensure walletId and passphrase are correct. The key is "passphrase" (not walletPassphrase).'
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const authData = await walletAuthRes.json();
    const walletToken = authData.token || authData.access_token || authData.jwt;
    if (!walletToken) {
      console.error('[GET-CPAY-WALLET-INFO] ❌ No wallet token received');
      return new Response(JSON.stringify({
        error: 'No wallet token received from CPAY',
        response: authData
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[GET-CPAY-WALLET-INFO] ✅ Wallet authenticated, token received');

    // ============================================================
    // STEP 4: FETCH CURRENCY LIST (using /api/public/currency)
    // ============================================================
    console.log('[GET-CPAY-WALLET-INFO] 💼 Fetching currency list from /api/public/currency...');

    const currencyResponse = await fetch(`${CPAY_BASE_URL}/api/public/currency`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${walletToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!currencyResponse.ok) {
      const errorText = await currencyResponse.text();
      console.error('[GET-CPAY-WALLET-INFO] ❌ Currency list fetch failed:', errorText);
      return new Response(JSON.stringify({
        error: 'Failed to fetch currency list',
        status: currencyResponse.status,
        details: errorText
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const currencyPayload = await currencyResponse.json();
    console.log('[GET-CPAY-WALLET-INFO] 📦 Currency payload type:', typeof currencyPayload);
    console.log('[GET-CPAY-WALLET-INFO] 📦 Currency payload structure:', JSON.stringify(currencyPayload).substring(0, 200));
    
    // CRITICAL FIX: Handle both direct array and { data: [...] } wrapped responses
    const currencies = Array.isArray(currencyPayload) 
      ? currencyPayload 
      : (currencyPayload.data || []);
    
    console.log('[GET-CPAY-WALLET-INFO] ✅ Currency list received:', currencies.length, 'currencies');
    
    if (!Array.isArray(currencies) || currencies.length === 0) {
      console.error('[GET-CPAY-WALLET-INFO] ❌ No currencies found in response');
      return new Response(JSON.stringify({
        error: 'No currencies found in CPAY response',
        details: 'The currency list is empty or malformed',
        rawPayload: currencyPayload
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============================================================
    // STEP 5: HANDLE DIFFERENT MODES
    // ============================================================
    if (mode === 'deposit') {
      // Mode: Extract token from last successful CPAY deposit
      console.log('[GET-CPAY-WALLET-INFO] 📦 MODE: Extracting token from last deposit...');
      
      const { data: lastDeposit, error: depositError } = await supabase
        .from('transactions')
        .select('metadata, created_at')
        .eq('type', 'deposit')
        .eq('payment_gateway', 'cpay')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (depositError || !lastDeposit) {
        console.log('[GET-CPAY-WALLET-INFO] ❌ No completed CPAY deposits found');
        return new Response(JSON.stringify({
          success: false,
          error: 'No completed CPAY deposits found',
          suggestion: 'Make a small USDT TRC20 deposit first, or use mode=wallet to fetch from wallet API'
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Extract wallet info from webhook payload
      const webhookPayload = lastDeposit.metadata?.webhook_payload;
      if (!webhookPayload) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Deposit found but webhook payload is missing',
          suggestion: 'Use mode=wallet instead'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const depositWalletId = webhookPayload.wallet?.id;
      const depositCurrency = webhookPayload.currency;
      const depositBlockchain = webhookPayload.blockchain;

      console.log('[GET-CPAY-WALLET-INFO] 📋 Deposit wallet ID:', depositWalletId);
      console.log('[GET-CPAY-WALLET-INFO] 💰 Currency:', depositCurrency, '| Blockchain:', depositBlockchain);

      // Guard: Ensure currencies is valid array before searching
      if (!Array.isArray(currencies) || currencies.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Currency list is empty or invalid',
          suggestion: 'Enable currencies in your CPAY account or try mode=wallet'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Find matching currency in the currency list
      const matchingCurrency = currencies.find((c: any) => 
        c.name?.toUpperCase() === depositCurrency?.toUpperCase() &&
        (c.nodeType?.toLowerCase() === depositBlockchain?.toLowerCase() || 
         c.blockchain?.toUpperCase() === depositBlockchain?.toUpperCase())
      );

      if (!matchingCurrency) {
        return new Response(JSON.stringify({
          success: false,
          error: `No matching currency found for ${depositCurrency} on ${depositBlockchain}`,
          depositInfo: { wallet: depositWalletId, currency: depositCurrency, blockchain: depositBlockchain },
          suggestion: 'The currency might not be enabled in your CPAY account'
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        source: 'last_deposit',
        depositDate: lastDeposit.created_at,
        token: {
          currencyId: matchingCurrency._id,
          currency: matchingCurrency.name,
          blockchain: matchingCurrency.nodeType || matchingCurrency.blockchain,
          currencyType: matchingCurrency.currencyType,
          message: '✅ This is the currency ID from your last CPAY deposit'
        },
        instructions: [
          '1. Copy the currencyId above (MongoDB ID)',
          '2. Update CPAY_USDT_TOKEN_ID secret with this value',
          '3. Retry pending withdrawals'
        ]
      }, null, 2), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============================================================
    // MODE: wallet (default) - Parse and format ALL currencies
    // ============================================================
    console.log('[GET-CPAY-WALLET-INFO] 📦 MODE: Processing all currencies from API...');
    console.log('[GET-CPAY-WALLET-INFO] 📊 Found', currencies.length, 'currencies');

    // Find USDT TRC20 specifically using correct CPAY fields
    const usdtTrc20 = currencies.find((c: any) => 
      c.name?.toUpperCase() === 'USDT' && 
      c.nodeType?.toLowerCase() === 'tron' &&
      c.currencyType === 'token'
    );

    const formattedCurrencies = currencies.map((currency: any) => ({
      currencyId: currency._id,  // MongoDB ID - this is what CPAY requires!
      name: currency.name,
      nodeType: currency.nodeType,
      blockchain: currency.blockchain,
      currencyType: currency.currencyType,
      isUsdtTrc20: currency._id === usdtTrc20?._id
    }));

    // ============================================================
    // RETURN RESULTS
    // ============================================================
    const result = {
      success: true,
      source: 'currency_api',
      walletId: CPAY_WALLET_ID,
      totalTokens: currencies.length,
      usdtTrc20Token: usdtTrc20 ? {
        currencyId: usdtTrc20._id,  // MongoDB ID from /api/public/currency
        name: usdtTrc20.name,
        nodeType: usdtTrc20.nodeType,
        blockchain: usdtTrc20.blockchain,
        currencyType: usdtTrc20.currencyType,
        message: '✅ THIS IS YOUR USDT TRC20 CURRENCY ID - Use this as CPAY_USDT_TOKEN_ID'
      } : null,
      allCurrencies: formattedCurrencies,
      instructions: [
        '1. Look for the currency marked with isUsdtTrc20: true',
        '2. Copy the currencyId value (this is the MongoDB _id from CPAY)',
        '3. Update the secret CPAY_USDT_TOKEN_ID with this exact 24-character hex value',
        '4. Retry the pending withdrawal from Admin > Withdrawals'
      ]
    };

    console.log('[GET-CPAY-WALLET-INFO] 🎉 SUCCESS - Currency info retrieved');
    if (usdtTrc20) {
      console.log('[GET-CPAY-WALLET-INFO] 🎯 USDT TRC20 currencyId (MongoDB _id):', usdtTrc20._id);
    } else {
      console.log('[GET-CPAY-WALLET-INFO] ⚠️ WARNING - USDT TRC20 not found in currency list');
    }

    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[GET-CPAY-WALLET-INFO] ❌ Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: errorMessage,
      stack: errorStack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
