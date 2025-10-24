import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

const CPAY_BASE_URL = 'https://api.cpay.world';

interface CPAYToken {
  currencyId: string;
  balance: string;
  holdBalance: string;
}

interface CPAYWalletResponse {
  data: {
    balance: string;
    balanceUSD: string;
    holdBalance: string;
    availableBalance: string;
    availableBalanceUSD: string;
    tokens: CPAYToken[];
  };
}

interface CPAYCurrency {
  _id: string;
  name: string;
  nodeType: string;
  currencyType: string;
  blockchain?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[GET-CPAY-WALLET-BALANCE] 🚀 Starting wallet balance fetch...');

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
      console.error('[GET-CPAY-WALLET-BALANCE] ❌ Unauthorized');
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
      console.error('[GET-CPAY-WALLET-BALANCE] ❌ Admin access required');
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[GET-CPAY-WALLET-BALANCE] ✅ Admin authenticated:', user.email);

    // ============================================================
    // STEP 2: GET CPAY CREDENTIALS
    // ============================================================
    const CPAY_WALLET_ID = Deno.env.get('CPAY_WALLET_ID');
    const CPAY_API_PUBLIC_KEY = Deno.env.get('CPAY_API_PUBLIC_KEY');
    const CPAY_API_PRIVATE_KEY = Deno.env.get('CPAY_API_PRIVATE_KEY');
    const CPAY_WALLET_PASSPHRASE = Deno.env.get('CPAY_WALLET_PASSPHRASE');

    const missingSecrets: string[] = [];
    if (!CPAY_WALLET_ID) missingSecrets.push('CPAY_WALLET_ID');
    if (!CPAY_API_PUBLIC_KEY) missingSecrets.push('CPAY_API_PUBLIC_KEY');
    if (!CPAY_API_PRIVATE_KEY) missingSecrets.push('CPAY_API_PRIVATE_KEY');
    if (!CPAY_WALLET_PASSPHRASE) missingSecrets.push('CPAY_WALLET_PASSPHRASE');

    if (missingSecrets.length > 0) {
      console.error('[GET-CPAY-WALLET-BALANCE] ❌ Missing CPAY credentials:', missingSecrets);
      return new Response(JSON.stringify({
        error: 'CPAY credentials not configured',
        missing: missingSecrets,
        message: 'Please configure all required CPAY secrets in your backend settings'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[GET-CPAY-WALLET-BALANCE] ✅ CPAY credentials found');
    console.log('[GET-CPAY-WALLET-BALANCE] 💼 Wallet ID:', CPAY_WALLET_ID);

    // ============================================================
    // STEP 3: CPAY AUTHENTICATION (Two-Step Process)
    // ============================================================
    console.log('[GET-CPAY-WALLET-BALANCE] 🔐 Starting two-step authentication...');

    // Step 1: Account authentication
    console.log('[GET-CPAY-WALLET-BALANCE] 📡 Step 1/2: Account authentication...');
    const accountAuthRes = await fetch(`${CPAY_BASE_URL}/api/public/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: CPAY_API_PUBLIC_KEY,
        privateKey: CPAY_API_PRIVATE_KEY,
      })
    });

    console.log('[GET-CPAY-WALLET-BALANCE] Account auth status:', accountAuthRes.status);

    if (!accountAuthRes.ok) {
      const errorText = await accountAuthRes.text();
      console.error('[GET-CPAY-WALLET-BALANCE] ❌ Account auth failed:', errorText);
      return new Response(JSON.stringify({
        error: 'CPAY account authentication failed',
        status: accountAuthRes.status,
        details: errorText
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Step 2: Wallet authentication
    console.log('[GET-CPAY-WALLET-BALANCE] 📡 Step 2/2: Wallet authentication...');
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

    console.log('[GET-CPAY-WALLET-BALANCE] Wallet auth status:', walletAuthRes.status);

    if (!walletAuthRes.ok) {
      const errorText = await walletAuthRes.text();
      console.error('[GET-CPAY-WALLET-BALANCE] ❌ Wallet auth failed:', errorText);
      return new Response(JSON.stringify({
        error: 'CPAY wallet authentication failed',
        status: walletAuthRes.status,
        details: errorText,
        hint: 'Verify walletId and passphrase are correct'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authData = await walletAuthRes.json();
    const walletToken = authData.token || authData.access_token || authData.jwt;

    if (!walletToken) {
      console.error('[GET-CPAY-WALLET-BALANCE] ❌ No wallet token received');
      return new Response(JSON.stringify({
        error: 'No wallet token received from CPAY',
        response: authData
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[GET-CPAY-WALLET-BALANCE] ✅ Wallet authenticated successfully');

    // ============================================================
    // STEP 4: FETCH WALLET BALANCE
    // ============================================================
    console.log('[GET-CPAY-WALLET-BALANCE] 💼 Fetching wallet balance...');

    const walletResponse = await fetch(`${CPAY_BASE_URL}/api/public/wallet`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${walletToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[GET-CPAY-WALLET-BALANCE] Wallet API status:', walletResponse.status);

    if (!walletResponse.ok) {
      const errorText = await walletResponse.text();
      console.error('[GET-CPAY-WALLET-BALANCE] ❌ Wallet fetch failed:', errorText);
      return new Response(JSON.stringify({
        error: 'Failed to fetch wallet balance',
        status: walletResponse.status,
        details: errorText
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const walletPayload: CPAYWalletResponse = await walletResponse.json();
    const wallet = walletPayload.data || walletPayload;

    console.log('[GET-CPAY-WALLET-BALANCE] ✅ Wallet balance retrieved');
    console.log('[GET-CPAY-WALLET-BALANCE] 💰 Balance:', wallet.balance, '| USD:', wallet.balanceUSD);
    console.log('[GET-CPAY-WALLET-BALANCE] 🪙 Tokens found:', wallet.tokens?.length || 0);
    
    if (!wallet.tokens || !Array.isArray(wallet.tokens)) {
      console.error('[GET-CPAY-WALLET-BALANCE] ❌ No tokens array in wallet response');
      return new Response(JSON.stringify({
        error: 'No tokens found in wallet',
        details: 'Your CPAY wallet returned no token entries. Enable USDT TRC20 in your CPAY account.',
        wallet: {
          balance: wallet.balance,
          balanceUSD: wallet.balanceUSD
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============================================================
    // STEP 5: FETCH CURRENCY LIST FOR ENRICHMENT (BEST-EFFORT)
    // ============================================================
    console.log('[GET-CPAY-WALLET-BALANCE] 📋 Fetching currency details...');

    // Helper: Defensive currency extraction from various payload shapes
    function extractCurrencies(payload: any): { arr: CPAYCurrency[]; source: string } {
      // Try direct array
      if (Array.isArray(payload)) {
        return { arr: payload, source: 'direct_array' };
      }
      
      // Try payload.data (most common wrapper)
      if (payload?.data && Array.isArray(payload.data)) {
        return { arr: payload.data, source: 'payload.data' };
      }
      
      // Try payload.currencies
      if (payload?.currencies && Array.isArray(payload.currencies)) {
        return { arr: payload.currencies, source: 'payload.currencies' };
      }
      
      // Try payload.data.currencies
      if (payload?.data?.currencies && Array.isArray(payload.data.currencies)) {
        return { arr: payload.data.currencies, source: 'payload.data.currencies' };
      }
      
      // Try payload.result
      if (payload?.result && Array.isArray(payload.result)) {
        return { arr: payload.result, source: 'payload.result' };
      }
      
      // Give up - return empty array (graceful degradation)
      return { arr: [], source: 'none_found' };
    }

    const warnings: string[] = [];
    let currencies: CPAYCurrency[] = [];
    let currencySource = 'unknown';

    try {
      const currencyResponse = await fetch(`${CPAY_BASE_URL}/api/public/currency`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${walletToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('[GET-CPAY-WALLET-BALANCE] Currency API status:', currencyResponse.status);

      if (!currencyResponse.ok) {
        const errorText = await currencyResponse.text();
        console.warn('[GET-CPAY-WALLET-BALANCE] ⚠️  Currency fetch failed (non-fatal):', errorText);
        warnings.push('Currency enrichment unavailable: API returned ' + currencyResponse.status);
        // Continue with empty currencies array
      } else {
        const currencyPayload = await currencyResponse.json();
        console.log('[GET-CPAY-WALLET-BALANCE] 📦 Currency payload type:', typeof currencyPayload);
        console.log('[GET-CPAY-WALLET-BALANCE] 📦 Currency payload preview:', JSON.stringify(currencyPayload).substring(0, 200));
        
        const extracted = extractCurrencies(currencyPayload);
        currencies = extracted.arr;
        currencySource = extracted.source;
        
        if (currencies.length === 0) {
          console.warn('[GET-CPAY-WALLET-BALANCE] ⚠️  No currencies extracted from payload (source: ' + currencySource + ')');
          warnings.push('Currency enrichment skipped: unrecognized payload structure');
        } else {
          console.log('[GET-CPAY-WALLET-BALANCE] ✅ Currency list extracted:', currencies.length, 'currencies (source: ' + currencySource + ')');
          
          // Log all USDT tokens for easy token ID extraction
          console.log('[GET-CPAY-WALLET-BALANCE] 🔍 Filtering USDT tokens...');
          const usdtTokens = currencies.filter((c: CPAYCurrency) => 
            c?.name?.toUpperCase().includes('USDT')
          );
          
          console.log('[GET-CPAY-WALLET-BALANCE] 💎 FULL USDT TOKEN DATA (Copy these IDs):');
          console.log('[GET-CPAY-WALLET-BALANCE] =====================================');
          usdtTokens.forEach((token: CPAYCurrency) => {
            console.log(JSON.stringify({
              _id: token._id,
              name: token.name,
              nodeType: token.nodeType,
              currencyType: token.currencyType,
              blockchain: token.blockchain
            }, null, 2));
            console.log('[GET-CPAY-WALLET-BALANCE] -------------------------------------');
          });
          console.log('[GET-CPAY-WALLET-BALANCE] =====================================');
          
          // Also log your wallet tokens
          console.log('[GET-CPAY-WALLET-BALANCE] 💰 YOUR WALLET TOKENS:');
          console.log(JSON.stringify(wallet.tokens, null, 2));
        }
      }
    } catch (currencyError) {
      console.warn('[GET-CPAY-WALLET-BALANCE] ⚠️  Currency fetch error (non-fatal):', currencyError);
      warnings.push('Currency enrichment unavailable: ' + (currencyError instanceof Error ? currencyError.message : 'fetch failed'));
    }

    // ============================================================
    // STEP 6: ENRICH TOKEN DATA WITH CURRENCY DETAILS (BEST-EFFORT)
    // ============================================================
    console.log('[GET-CPAY-WALLET-BALANCE] 🔗 Enriching token data...');
    
    // Build currency map for O(1) lookups (prevents "find is not a function" errors)
    const currencyMap: Record<string, CPAYCurrency> = Object.create(null);
    for (const c of currencies) {
      if (c?._id) {
        currencyMap[c._id] = c;
      }
    }

    const enrichedTokens = (wallet.tokens || []).map((token: CPAYToken) => {
      const currency = currencyMap[token.currencyId];
      
      // Best-effort USDT TRC20 detection (only when currency data available)
      const isUsdtTrc20 = currency 
        ? (currency.name?.toUpperCase() === 'USDT' && 
           currency.nodeType?.toLowerCase() === 'tron' &&
           currency.currencyType === 'token')
        : false;

      return {
        currencyId: token.currencyId,
        name: currency?.name || 'Unknown',
        nodeType: currency?.nodeType || 'Unknown',
        currencyType: currency?.currencyType || 'Unknown',
        balance: token.balance,
        holdBalance: token.holdBalance,
        isUsdtTrc20: isUsdtTrc20
      };
    });

    const usdtTrc20Token = enrichedTokens.find((t: any) => t.isUsdtTrc20);

    console.log('[GET-CPAY-WALLET-BALANCE] 🎯 USDT TRC20 found:', !!usdtTrc20Token);
    if (usdtTrc20Token) {
      console.log('[GET-CPAY-WALLET-BALANCE] 💎 USDT TRC20 currencyId:', usdtTrc20Token.currencyId);
    } else if (warnings.length > 0) {
      console.log('[GET-CPAY-WALLET-BALANCE] ⚠️  USDT TRC20 not detected (enrichment unavailable)');
    }

    // ============================================================
    // STEP 7: RETURN COMPREHENSIVE RESULT
    // ============================================================
    const result = {
      success: true,
      source: 'wallet',
      wallet: {
        id: CPAY_WALLET_ID,
        balance: wallet.balance,
        balanceUSD: wallet.balanceUSD,
        holdBalance: wallet.holdBalance,
        availableBalance: wallet.availableBalance,
        availableBalanceUSD: wallet.availableBalanceUSD,
      },
      tokens: enrichedTokens,
      usdtTrc20: usdtTrc20Token || null,
      warnings: warnings.length > 0 ? warnings : undefined,
      tips: [
        'Use the currencyId from USDT TRC20 token as CPAY_USDT_TOKEN_ID',
        'Ensure you have sufficient TRX balance for miner fees',
        'Copy the 24-character currencyId to update your secret'
      ]
    };

    if (warnings.length > 0) {
      console.log('[GET-CPAY-WALLET-BALANCE] ⚠️  Completed with warnings:', warnings.length);
    }
    console.log('[GET-CPAY-WALLET-BALANCE] 🎉 SUCCESS - Wallet balance retrieved');

    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[GET-CPAY-WALLET-BALANCE] ❌ Unexpected error:', error);
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
