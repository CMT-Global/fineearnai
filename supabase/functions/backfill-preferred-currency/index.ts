import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Country to Currency Mapping (same as track-user-registration)
 */
const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  // Africa
  'ZA': 'ZAR', 'NG': 'NGN', 'EG': 'EGP', 'KE': 'KES', 'GH': 'GHS',
  'TZ': 'TZS', 'UG': 'UGX', 'MA': 'MAD', 'ET': 'ETB', 'DZ': 'DZD',
  
  // Americas
  'US': 'USD', 'CA': 'CAD', 'BR': 'BRL', 'MX': 'MXN', 'AR': 'ARS',
  'CL': 'CLP', 'CO': 'COP', 'PE': 'PEN',
  
  // Europe
  'GB': 'GBP', 'EU': 'EUR', 'DE': 'EUR', 'FR': 'EUR', 'IT': 'EUR',
  'ES': 'EUR', 'NL': 'EUR', 'BE': 'EUR', 'AT': 'EUR', 'PT': 'EUR',
  'IE': 'EUR', 'GR': 'EUR', 'PL': 'PLN', 'RO': 'RON', 'CZ': 'CZK',
  'HU': 'HUF', 'SE': 'SEK', 'DK': 'DKK', 'NO': 'NOK', 'CH': 'CHF',
  'TR': 'TRY', 'RU': 'RUB', 'UA': 'UAH',
  
  // Asia
  'CN': 'CNY', 'IN': 'INR', 'JP': 'JPY', 'KR': 'KRW', 'ID': 'IDR',
  'TH': 'THB', 'MY': 'MYR', 'SG': 'SGD', 'PH': 'PHP', 'VN': 'VND',
  'BD': 'BDT', 'PK': 'PKR', 'LK': 'LKR', 'MM': 'MMK', 'KH': 'KHR',
  
  // Middle East
  'SA': 'SAR', 'AE': 'AED', 'IL': 'ILS', 'QA': 'QAR', 'KW': 'KWD',
  'OM': 'OMR', 'BH': 'BHD', 'JO': 'JOD', 'LB': 'LBP',
  
  // Oceania
  'AU': 'AUD', 'NZ': 'NZD',
};

function getCurrencyForCountry(countryCode: string | null | undefined): string {
  if (!countryCode) return 'USD';
  const upperCode = countryCode.trim().toUpperCase();
  return COUNTRY_CURRENCY_MAP[upperCode] || 'USD';
}

/**
 * Backfill Preferred Currency - One-Time Migration
 * 
 * Purpose: Update existing users who still have USD as preferred_currency
 *          but have a registration_country set, to use their country's currency
 * 
 * Usage: Admin-only function, run once after deploying auto-currency detection
 * 
 * Safety:
 * - Only updates users with registration_country AND preferred_currency = 'USD'
 * - Does not override manually changed currencies
 * - Provides detailed statistics and logging
 * - Can be run multiple times safely (idempotent)
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Check if user is admin
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roles) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('🚀 [Backfill] Starting preferred_currency backfill migration');

    // Find users who need currency update
    const { data: users, error: queryError } = await supabase
      .from('profiles')
      .select('id, username, registration_country, registration_country_name, preferred_currency')
      .eq('preferred_currency', 'USD')
      .not('registration_country', 'is', null);

    if (queryError) {
      console.error('❌ [Backfill] Query error:', queryError);
      throw queryError;
    }

    if (!users || users.length === 0) {
      console.log('✅ [Backfill] No users need currency update');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No users require currency update',
          stats: {
            total_checked: 0,
            updated: 0,
            skipped: 0,
            errors: 0,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`📊 [Backfill] Found ${users.length} users to process`);

    // Process each user
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const updateDetails: any[] = [];

    for (const user of users) {
      const detectedCurrency = getCurrencyForCountry(user.registration_country);

      // Skip if detected currency is still USD (no mapping available)
      if (detectedCurrency === 'USD') {
        skipped++;
        console.log(`⏭️ [Backfill] Skipped ${user.username} (${user.registration_country}): No currency mapping`);
        continue;
      }

      // Update user's preferred_currency
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ preferred_currency: detectedCurrency })
        .eq('id', user.id);

      if (updateError) {
        errors++;
        console.error(`❌ [Backfill] Failed to update ${user.username}:`, updateError);
        updateDetails.push({
          username: user.username,
          country: user.registration_country,
          status: 'error',
          error: updateError.message,
        });
      } else {
        updated++;
        console.log(`✅ [Backfill] Updated ${user.username}: ${user.registration_country} → ${detectedCurrency}`);
        updateDetails.push({
          username: user.username,
          country: user.registration_country_name,
          country_code: user.registration_country,
          old_currency: 'USD',
          new_currency: detectedCurrency,
          status: 'updated',
        });
      }
    }

    const executionTime = Date.now() - startTime;
    console.log(`✅ [Backfill] Migration complete in ${executionTime}ms`);
    console.log(`📊 [Backfill] Stats: ${updated} updated, ${skipped} skipped, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Backfill migration completed',
        stats: {
          total_checked: users.length,
          updated,
          skipped,
          errors,
        },
        execution_time_ms: executionTime,
        sample_updates: updateDetails.slice(0, 10), // Return first 10 for inspection
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    console.error('❌ [Backfill] Unexpected error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'internal_error',
        message: error.message || 'Failed to complete backfill migration',
        execution_time_ms: executionTime,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
