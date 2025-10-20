import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

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
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse request body
    const { targetCurrencyCode }: ConversionRequest = await req.json();

    // Validate input
    if (!targetCurrencyCode || typeof targetCurrencyCode !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid currency code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currencyCode = targetCurrencyCode.toUpperCase();

    // Validate currency code format (3 letters)
    if (!/^[A-Z]{3}$/.test(currencyCode)) {
      return new Response(
        JSON.stringify({ error: 'Currency code must be 3 letters (ISO 4217)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isDev = Deno.env.get('ENVIRONMENT') !== 'production';
    
    if (isDev) {
      console.log(`💱 Currency conversion request: USD → ${currencyCode} for user ${user.id}`);
    }

    // If USD, return rate of 1 immediately
    if (currencyCode === 'USD') {
      if (isDev) {
        console.log('✅ USD requested, returning rate of 1');
      }
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
      if (isDev) {
        console.log(`✅ Cache hit for ${currencyCode}: ${cachedEntry.rate}`);
      }
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
    if (isDev) {
      console.log(`🔄 Cache miss for ${currencyCode}, fetching from OpenExchangeRates API...`);
    }

    const apiKey = Deno.env.get('OPENEXCHANGERATES_APP_ID');
    if (!apiKey) {
      console.error('❌ OPENEXCHANGERATES_APP_ID not configured');
      // Fallback to USD
      return new Response(
        JSON.stringify({
          exchangeRate: 1,
          currency: 'USD',
          cached: false,
          lastUpdated: new Date().toISOString(),
          error: 'API key not configured, falling back to USD',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch latest rates from OpenExchangeRates
    const apiUrl = `https://openexchangerates.org/api/latest.json?app_id=${apiKey}&base=USD&symbols=${currencyCode}`;
    
    if (isDev) {
      console.log(`📡 Fetching: ${apiUrl.replace(apiKey, '***')}`);
    }

    const apiResponse = await fetch(apiUrl);

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`❌ OpenExchangeRates API error (${apiResponse.status}):`, errorText);
      
      // Fallback to USD on API error
      return new Response(
        JSON.stringify({
          exchangeRate: 1,
          currency: 'USD',
          cached: false,
          lastUpdated: new Date().toISOString(),
          error: `API error: ${apiResponse.status}`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiData = await apiResponse.json();
    
    // Extract exchange rate
    const exchangeRate = apiData.rates?.[currencyCode];
    if (!exchangeRate || typeof exchangeRate !== 'number') {
      console.error(`❌ Currency ${currencyCode} not found in API response`);
      
      // Fallback to USD
      return new Response(
        JSON.stringify({
          exchangeRate: 1,
          currency: 'USD',
          cached: false,
          lastUpdated: new Date().toISOString(),
          error: `Currency ${currencyCode} not supported`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cache the rate for 24 hours
    exchangeRateCache.set(currencyCode, {
      rate: exchangeRate,
      expiresAt: Date.now() + CACHE_TTL,
    });
    
    if (isDev) {
      console.log(`✅ Cached exchange rate for ${currencyCode}: ${exchangeRate} (valid for 24h)`);
    }

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
    console.error('❌ Error in convert-usd-to-local:', error);
    
    // Always fallback to USD on critical errors
    return new Response(
      JSON.stringify({
        exchangeRate: 1,
        currency: 'USD',
        cached: false,
        lastUpdated: new Date().toISOString(),
        error: error.message || 'Internal server error',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
