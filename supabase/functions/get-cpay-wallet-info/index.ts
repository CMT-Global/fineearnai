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
    const mode = searchParams.get('mode') || 'wallet'; // 'wallet' or 'deposit'

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
    console.log('[GET-CPAY-WALLET-INFO] 📡 Step 1: Authenticating wallet with CPAY...');

    // Use the working /api/public/auth endpoint with wallet credentials
    const authResponse = await fetch(`${CPAY_BASE_URL}/api/public/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey: CPAY_API_PUBLIC_KEY,
      privateKey: CPAY_API_PRIVATE_KEY,
      walletId: CPAY_WALLET_ID,
      passphrase: CPAY_WALLET_PASSPHRASE
    })
    });

    console.log('[GET-CPAY-WALLET-INFO] Response status:', authResponse.status);

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error('[GET-CPAY-WALLET-INFO] ❌ Wallet auth failed:', errorText);
      return new Response(JSON.stringify({
        error: 'CPAY wallet authentication failed',
        status: authResponse.status,
        details: errorText,
        hint: 'Using the same auth flow that works for deposits. Check CPAY_WALLET_ID and CPAY_WALLET_PASSPHRASE.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authData = await authResponse.json();
    console.log('[GET-CPAY-WALLET-INFO] Response body:', JSON.stringify(authData).substring(0, 200));

    const walletToken = authData.token;
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
    // STEP 4: FETCH WALLET INFO (using public/wallet endpoint)
    // ============================================================
    console.log('[GET-CPAY-WALLET-INFO] 💼 Fetching wallet info from /api/public/wallet...');

    const walletResponse = await fetch(`${CPAY_BASE_URL}/api/public/wallet`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${walletToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!walletResponse.ok) {
      const errorText = await walletResponse.text();
      console.error('[GET-CPAY-WALLET-INFO] ❌ Wallet fetch failed:', errorText);
      return new Response(JSON.stringify({
        error: 'Failed to fetch wallet info',
        status: walletResponse.status,
        details: errorText
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const walletData = await walletResponse.json();
    console.log('[GET-CPAY-WALLET-INFO] ✅ Wallet info received');

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

      // Now fetch wallet to find the matching token
      const tokens = walletData.tokens || [];
      const matchingToken = tokens.find((t: any) => 
        t.currency?.toUpperCase() === depositCurrency?.toUpperCase() &&
        t.blockchain?.toUpperCase() === depositBlockchain?.toUpperCase()
      );

      if (!matchingToken) {
        return new Response(JSON.stringify({
          success: false,
          error: `No matching token found for ${depositCurrency} on ${depositBlockchain}`,
          depositInfo: { wallet: depositWalletId, currency: depositCurrency, blockchain: depositBlockchain },
          suggestion: 'The deposit wallet might be different from your configured CPAY_WALLET_ID'
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
          currencyId: matchingToken.currencyId,
          currency: matchingToken.currency,
          blockchain: matchingToken.blockchain,
          balance: matchingToken.balance,
          address: matchingToken.address,
          message: '✅ This is the token from your last CPAY deposit'
        },
        instructions: [
          '1. Copy the currencyId above',
          '2. Update CPAY_USDT_TOKEN_ID secret with this value',
          '3. Retry pending withdrawals'
        ]
      }, null, 2), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============================================================
    // MODE: wallet (default) - Parse and format ALL tokens
    // ============================================================
    console.log('[GET-CPAY-WALLET-INFO] 📦 MODE: Fetching all wallet tokens...');
    const tokens = walletData.tokens || [];
    console.log('[GET-CPAY-WALLET-INFO] 📊 Found', tokens.length, 'tokens');

    // Find USDT TRC20 specifically
    const usdtTrc20 = tokens.find((t: any) => 
      t.currency?.toUpperCase() === 'USDT' && 
      (t.blockchain?.toUpperCase() === 'TRC20' || t.blockchain?.toUpperCase() === 'TRX')
    );

    const formattedTokens = tokens.map((token: any) => ({
      currencyId: token.currencyId,
      currency: token.currency,
      blockchain: token.blockchain,
      balance: token.balance,
      address: token.address,
      isUsdtTrc20: token.currencyId === usdtTrc20?.currencyId
    }));

    // ============================================================
    // RETURN RESULTS
    // ============================================================
    const result = {
      success: true,
      source: 'wallet_api',
      walletId: CPAY_WALLET_ID,
      totalTokens: tokens.length,
      usdtTrc20Token: usdtTrc20 ? {
        currencyId: usdtTrc20.currencyId,
        balance: usdtTrc20.balance,
        address: usdtTrc20.address,
        blockchain: usdtTrc20.blockchain,
        message: '✅ THIS IS YOUR USDT TRC20 TOKEN ID - Use this as CPAY_USDT_TOKEN_ID'
      } : {
        message: '❌ USDT TRC20 not found in wallet'
      },
      allTokens: formattedTokens,
      instructions: [
        '1. Look for the token marked with isUsdtTrc20: true',
        '2. Copy the currencyId value (24-character hex ID)',
        '3. Update the secret CPAY_USDT_TOKEN_ID with this value',
        '4. Retry the pending withdrawal from Admin > Withdrawals'
      ]
    };

    console.log('[GET-CPAY-WALLET-INFO] 🎉 SUCCESS - Token info retrieved');
    if (usdtTrc20) {
      console.log('[GET-CPAY-WALLET-INFO] 🎯 USDT TRC20 currencyId:', usdtTrc20.currencyId);
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
