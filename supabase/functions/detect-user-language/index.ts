/**
 * Detect User Language - IP-Based Language Detection
 * 
 * Purpose: Detect user's country from IP address and return appropriate language code
 * Called by: Frontend on first visit or when language preference is not set
 * 
 * Flow:
 * 1. Extract client IP from request headers
 * 2. Call IPStack API to get country information
 * 3. Map country code to language code
 * 4. Return language code (e.g., "en", "es", "fr", "de", "it")
 * 
 * CRITICAL: Never blocks - failures gracefully fallback to "en"
 */

import { getLocationFromIP, extractClientIP } from '../_shared/ipstack.ts';

/**
 * Maps country codes to language codes
 * Inline version since we can't import from src/ in edge functions
 */
function getLanguageFromCountry(countryCode: string | null | undefined): string {
  if (!countryCode) return 'en';
  
  const upperCode = countryCode.toUpperCase();
  
  // English-speaking countries
  const englishCountries = ['US', 'GB', 'AU', 'CA', 'NZ', 'IE', 'ZA', 'SG', 'MY', 'PH', 'IN', 'PK', 'BD', 'LK', 'NG', 'KE', 'GH', 'TZ', 'UG', 'ZW', 'JM', 'TT', 'BB', 'BS', 'BZ', 'GY'];
  if (englishCountries.includes(upperCode)) return 'en';
  
  // Spanish-speaking countries
  const spanishCountries = ['ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT', 'CU', 'BO', 'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PA', 'UY', 'PR'];
  if (spanishCountries.includes(upperCode)) return 'es';
  
  // French-speaking countries
  const frenchCountries = ['FR', 'BE', 'CH', 'LU', 'MC', 'AD', 'CD', 'CG', 'CI', 'SN', 'CM', 'MG', 'ML', 'BF', 'NE', 'TD', 'GA', 'GN', 'BJ', 'TG', 'CF', 'RW', 'BI', 'DJ', 'KM', 'HT'];
  if (frenchCountries.includes(upperCode)) return 'fr';
  
  // German-speaking countries
  const germanCountries = ['DE', 'AT', 'LI'];
  if (germanCountries.includes(upperCode)) return 'de';
  
  // Italian-speaking countries
  const italianCountries = ['IT', 'SM', 'VA'];
  if (italianCountries.includes(upperCode)) return 'it';
  
  // Default fallback
  return 'en';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🌍 [Language Detection] Starting IP-based language detection...');

    // Extract client IP from request headers
    const clientIP = extractClientIP(req);
    
    if (!clientIP) {
      console.warn('⚠️ [Language Detection] Could not extract client IP, returning default (en)');
      return new Response(
        JSON.stringify({
          success: true,
          language: 'en',
          detected: false,
          reason: 'ip_not_found',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`🔍 [Language Detection] Extracted IP: ${clientIP}`);

    // Get location from IPStack (pass supabase client to read API key from platform_config)
    // We need to create a supabase client for this
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    let supabaseClient: any = null;
    if (supabaseUrl && supabaseServiceKey) {
      // @ts-ignore - Deno import
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    }

    const locationData = await getLocationFromIP(clientIP, supabaseClient);
    
    if (!locationData) {
      console.warn(`⚠️ [Language Detection] IPStack lookup failed for ${clientIP}, returning default (en)`);
      return new Response(
        JSON.stringify({
          success: true,
          language: 'en',
          detected: false,
          reason: 'location_lookup_failed',
          ip: clientIP,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`✅ [Language Detection] Location found: ${locationData.country_name} (${locationData.country_code})`);

    // Map country code to language code
    const language = getLanguageFromCountry(locationData.country_code);

    console.log(`🌐 [Language Detection] Mapped ${locationData.country_code} → ${language}`);

    return new Response(
      JSON.stringify({
        success: true,
        language,
        detected: true,
        country_code: locationData.country_code,
        country_name: locationData.country_name,
        ip: clientIP,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ [Language Detection] Unexpected error:', error);
    
    // Always return success with default language - never block the user
    return new Response(
      JSON.stringify({
        success: true,
        language: 'en',
        detected: false,
        reason: 'error',
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});
