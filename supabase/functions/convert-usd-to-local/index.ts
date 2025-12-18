import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getSystemSecrets } from '../_shared/secrets.ts';

/**
 * Currency Conversion Edge Function
 * 
 * Converts USD amounts to user's preferred currency using OpenExchangeRates API
 * Features:
 * - In-memory caching with 24-hour TTL
 * - Single API call per currency per day
 * - Optimized for 1M+ users
 * - Automatic fallback to USD on errors
 */

// Simple in-memory cache with TTL
interface CacheEntry {
  rate: number;
  expiresAt: number;
}

const exchangeRateCache = new Map<string, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface ConversionRequest {
  targetCurrencyCode: string;
}

interface ConversionResponse {
  exchangeRate: number;
  currency: string;
  cached: boolean;
  lastUpdated: string;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    // Initialize Supabase client with service role to ensure access to config
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch secrets using the shared utility
    const secrets = await getSystemSecrets(supabase);
    const apiKey = secrets.openExchangeAppId;

    // Verify user authentication (for security, only logged-in users can use this)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      console.error('[CONVERT-USD-TO-LOCAL] Auth error:', authError);
      throw new Error('Unauthorized');
    }
    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { targetCurrencyCode }: ConversionRequest = body;

    // Validate input
    if (!targetCurrencyCode || typeof targetCurrencyCode !== 'string') {
      return new Response(JSON.stringify({
        error: 'Invalid currency code'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const currencyCode = targetCurrencyCode.toUpperCase();
    // Validate currency code format (3 letters)
    if (!/^[A-Z]{3}$/.test(currencyCode)) {
      return new Response(JSON.stringify({
        error: 'Currency code must be 3 letters (ISO 4217)'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log(`[CONVERT-USD-TO-LOCAL] 💱 Request: USD → ${currencyCode} for user ${user.id}`);

    // If USD, return rate of 1 immediately
    if (currencyCode === 'USD') {
      return new Response(
        JSON.stringify({
          exchangeRate: 1,
          currency: 'USD',
          cached: false,
          lastUpdated: new Date().toISOString(),
        } as ConversionResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // Check cache first
    const cachedEntry = exchangeRateCache.get(currencyCode);
    if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
      console.log(`[CONVERT-USD-TO-LOCAL] ✅ Cache hit for ${currencyCode}: ${cachedEntry.rate}`);
      return new Response(
        JSON.stringify({
          exchangeRate: cachedEntry.rate,
          currency: currencyCode,
          cached: true,
          lastUpdated: new Date().toISOString(),
        } as ConversionResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // Cache miss - fetch from OpenExchangeRates API
    if (!apiKey) {
      console.error('[CONVERT-USD-TO-LOCAL] ❌ OpenExchangeRates App ID not configured in Admin Panel or Env');
      // Fallback to USD
      return new Response(
        JSON.stringify({
          exchangeRate: 1,
          currency: 'USD',
          cached: false,
          lastUpdated: new Date().toISOString(),
          error: 'API key not configured, falling back to USD',
        } as ConversionResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CONVERT-USD-TO-LOCAL] 🔄 Cache miss for ${currencyCode}, fetching from OpenExchangeRates...`);

    // Fetch latest rates from OpenExchangeRates
    // Note: Free plan only supports USD base, which we use here.
    const apiUrl = `https://openexchangerates.org/api/latest.json?app_id=${apiKey}&base=USD&symbols=${currencyCode}`;

    const apiResponse = await fetch(apiUrl);
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`[CONVERT-USD-TO-LOCAL] ❌ API error (${apiResponse.status}):`, errorText);
      
      // Fallback to USD on API error
      return new Response(
        JSON.stringify({
          exchangeRate: 1,
          currency: 'USD',
          cached: false,
          lastUpdated: new Date().toISOString(),
          error: `OpenExchangeRates API error: ${apiResponse.status}`,
        } as ConversionResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const apiData = await apiResponse.json();
    // Extract exchange rate
    const exchangeRate = apiData.rates?.[currencyCode];
    if (!exchangeRate || typeof exchangeRate !== 'number') {
      console.error(`[CONVERT-USD-TO-LOCAL] ❌ Currency ${currencyCode} not found in API response`);
      
      // Fallback to USD
      return new Response(
        JSON.stringify({
          exchangeRate: 1,
          currency: 'USD',
          cached: false,
          lastUpdated: new Date().toISOString(),
          error: `Currency ${currencyCode} not supported by API`,
        } as ConversionResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // Cache the rate for 24 hours
    exchangeRateCache.set(currencyCode, {
      rate: exchangeRate,
      expiresAt: Date.now() + CACHE_TTL
    });
    
    console.log(`[CONVERT-USD-TO-LOCAL] ✅ Cached new rate for ${currencyCode}: ${exchangeRate}`);

    return new Response(
      JSON.stringify({
        exchangeRate,
        currency: currencyCode,
        cached: false,
        lastUpdated: new Date().toISOString(),
      } as ConversionResponse),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CONVERT-USD-TO-LOCAL] ❌ Critical error:', error);
    
    // Always fallback to USD on critical errors
    return new Response(
      JSON.stringify({
        exchangeRate: 1,
        currency: 'USD',
        cached: false,
        lastUpdated: new Date().toISOString(),
        error: error.message || 'Internal server error',
      } as ConversionResponse),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
