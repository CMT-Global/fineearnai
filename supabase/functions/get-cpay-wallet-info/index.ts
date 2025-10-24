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
    // STEP 2: GET CPAY CREDENTIALS
    // ============================================================
    const CPAY_ACCOUNT_ID = Deno.env.get('CPAY_ACCOUNT_ID');
    const CPAY_WALLET_ID = Deno.env.get('CPAY_WALLET_ID');
    const CPAY_API_PUBLIC_KEY = Deno.env.get('CPAY_API_PUBLIC_KEY');
    const CPAY_API_PRIVATE_KEY = Deno.env.get('CPAY_API_PRIVATE_KEY');
    const CPAY_WALLET_PASSPHRASE = Deno.env.get('CPAY_WALLET_PASSPHRASE');

    if (!CPAY_ACCOUNT_ID || !CPAY_WALLET_ID || !CPAY_API_PUBLIC_KEY || !CPAY_API_PRIVATE_KEY || !CPAY_WALLET_PASSPHRASE) {
      console.error('[GET-CPAY-WALLET-INFO] ❌ Missing CPAY credentials');
      return new Response(JSON.stringify({
        error: 'CPAY credentials not configured',
        missing: {
          accountId: !CPAY_ACCOUNT_ID,
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

    console.log('[GET-CPAY-WALLET-INFO] ✅ CPAY credentials found');
    console.log('[GET-CPAY-WALLET-INFO] 📋 Account ID:', CPAY_ACCOUNT_ID);
    console.log('[GET-CPAY-WALLET-INFO] 💼 Wallet ID:', CPAY_WALLET_ID);

    // ============================================================
    // STEP 3: PERFORM 2-STEP AUTHENTICATION
    // ============================================================
    console.log('[GET-CPAY-WALLET-INFO] 🔐 Step 1/2: Initial login...');

    // Step 1: Initial login
    const loginResponse = await fetch(`${CPAY_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: CPAY_ACCOUNT_ID,
        publicKey: CPAY_API_PUBLIC_KEY
      })
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      console.error('[GET-CPAY-WALLET-INFO] ❌ Login failed:', errorText);
      return new Response(JSON.stringify({
        error: 'CPAY login failed',
        status: loginResponse.status,
        details: errorText
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const loginData = await loginResponse.json();
    const otpToken = loginData.otpToken;

    if (!otpToken) {
      console.error('[GET-CPAY-WALLET-INFO] ❌ No OTP token received');
      return new Response(JSON.stringify({
        error: 'No OTP token received from CPAY',
        response: loginData
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[GET-CPAY-WALLET-INFO] ✅ OTP token received');

    // Step 2: Sign OTP token and complete 2FA
    console.log('[GET-CPAY-WALLET-INFO] 🔐 Step 2/2: Completing 2FA...');

    // Import crypto key
    const privateKeyData = Uint8Array.from(atob(CPAY_API_PRIVATE_KEY), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      privateKeyData,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Sign OTP token
    const encoder = new TextEncoder();
    const signatureBuffer = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      encoder.encode(otpToken)
    );
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    // Complete 2FA
    const twoFaResponse = await fetch(`${CPAY_BASE_URL}/api/v1/auth/2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        otpToken,
        signature
      })
    });

    if (!twoFaResponse.ok) {
      const errorText = await twoFaResponse.text();
      console.error('[GET-CPAY-WALLET-INFO] ❌ 2FA failed:', errorText);
      return new Response(JSON.stringify({
        error: 'CPAY 2FA failed',
        status: twoFaResponse.status,
        details: errorText
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const twoFaData = await twoFaResponse.json();
    const accessToken = twoFaData.accessToken;

    if (!accessToken) {
      console.error('[GET-CPAY-WALLET-INFO] ❌ No access token received');
      return new Response(JSON.stringify({
        error: 'No access token received from CPAY',
        response: twoFaData
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[GET-CPAY-WALLET-INFO] ✅ Authentication successful, access token received');

    // ============================================================
    // STEP 4: FETCH WALLET INFO
    // ============================================================
    console.log('[GET-CPAY-WALLET-INFO] 💼 Fetching wallet info...');

    const walletResponse = await fetch(`${CPAY_BASE_URL}/api/v1/wallet`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
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
    // STEP 5: PARSE AND FORMAT TOKENS
    // ============================================================
    const tokens = walletData.tokens || [];
    console.log('[GET-CPAY-WALLET-INFO] 📊 Found', tokens.length, 'tokens');

    // Find USDT TRC20 specifically
    const usdtTrc20 = tokens.find((t: any) => 
      t.currency?.toUpperCase() === 'USDT' && 
      t.blockchain?.toUpperCase() === 'TRC20'
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
    // STEP 6: RETURN RESULTS
    // ============================================================
    const result = {
      success: true,
      walletId: CPAY_WALLET_ID,
      accountId: CPAY_ACCOUNT_ID,
      totalTokens: tokens.length,
      usdtTrc20Token: usdtTrc20 ? {
        currencyId: usdtTrc20.currencyId,
        balance: usdtTrc20.balance,
        address: usdtTrc20.address,
        message: '✅ THIS IS YOUR USDT TRC20 TOKEN ID - Use this as CPAY_USDT_TOKEN_ID'
      } : {
        message: '❌ USDT TRC20 not found in wallet'
      },
      allTokens: formattedTokens,
      instructions: [
        '1. Look for the token marked with isUsdtTrc20: true',
        '2. Copy the currencyId value (24-character MongoDB ID)',
        '3. Update the secret CPAY_USDT_TOKEN_ID with this value',
        '4. Retry the pending withdrawal from Admin > Withdrawals',
        '5. Delete this temporary edge function when done'
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
