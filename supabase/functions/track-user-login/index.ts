import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { getLocationFromIP, extractClientIP } from '../_shared/ipstack.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Track User Login - IPStack Integration (Phase 5)
 * 
 * Purpose: Capture and update user's IP and country information at each login
 * Called by: Login flow immediately after successful auth.signInWithPassword
 * 
 * Flow:
 * 1. Extract client IP from request headers
 * 2. Call IPStack API to get country information
 * 3. Update profiles table with last login location data
 * 4. Update last_login timestamp
 * 5. Log activity for security audit trail
 * 
 * CRITICAL: Never blocks login flow - failures are logged but ignored
 */
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { userId } = await req.json();

    if (!userId) {
      console.error('❌ [Login Tracking] Missing userId in request');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'validation_error',
          message: 'userId is required' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log(`🚀 [Login Tracking] Started for user: ${userId}`);

    // Extract client IP from headers
    const clientIP = extractClientIP(req);
    
    if (!clientIP) {
      console.warn(`⚠️ [Login Tracking] Could not extract IP for user ${userId}`);
      
      // Update last_login timestamp only
      await supabase
        .from('profiles')
        .update({
          last_login: new Date().toISOString(),
          last_activity: new Date().toISOString(),
        })
        .eq('id', userId);

      // Log activity without location data
      await supabase
        .from('user_activity_log')
        .insert({
          user_id: userId,
          activity_type: 'login',
          details: {
            note: 'IP extraction failed',
            timestamp: new Date().toISOString(),
          },
        });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Login logged without location data',
          hasLocation: false,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`🔍 [Login Tracking] Extracted IP: ${clientIP}`);

    // Get location from IPStack
    const locationData = await getLocationFromIP(clientIP);
    
    if (!locationData) {
      console.warn(`⚠️ [Login Tracking] IPStack lookup failed for ${clientIP}`);
      
      // Update profile with IP and timestamp only (no country data)
      await supabase
        .from('profiles')
        .update({
          last_login_ip: clientIP,
          last_login: new Date().toISOString(),
          last_activity: new Date().toISOString(),
        })
        .eq('id', userId);

      // Log activity with IP but no location
      await supabase
        .from('user_activity_log')
        .insert({
          user_id: userId,
          activity_type: 'login',
          ip_address: clientIP,
          details: {
            note: 'Location lookup failed',
            timestamp: new Date().toISOString(),
          },
        });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Login logged with IP only',
          hasLocation: false,
          ip: clientIP,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`✅ [Login Tracking] Location found: ${locationData.country_name} (${locationData.country_code})`);

    // Update profile with last login location and timestamp
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        last_login_ip: clientIP,
        last_login_country: locationData.country_code,
        last_login_country_name: locationData.country_name,
        last_login: new Date().toISOString(),
        last_activity: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error(`❌ [Login Tracking] Failed to update profile:`, updateError);
      throw updateError;
    }

    // Log activity with full details for security monitoring
    const { error: logError } = await supabase
      .from('user_activity_log')
      .insert({
        user_id: userId,
        activity_type: 'login',
        ip_address: clientIP,
        details: {
          country_code: locationData.country_code,
          country_name: locationData.country_name,
          region_name: locationData.region_name,
          city: locationData.city,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          timestamp: new Date().toISOString(),
        },
      });

    if (logError) {
      console.error(`❌ [Login Tracking] Failed to log activity:`, logError);
      // Don't throw - profile update succeeded
    }

    const executionTime = Date.now() - startTime;
    console.log(`✅ [Login Tracking] Completed for ${userId} in ${executionTime}ms`);
    console.log(`📊 [Login Tracking] Data: ${locationData.country_name} (${locationData.country_code}) | IP: ${clientIP}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Login location tracked successfully',
        hasLocation: true,
        data: {
          ip: clientIP,
          country_code: locationData.country_code,
          country_name: locationData.country_name,
          region: locationData.region_name,
          city: locationData.city,
        },
        executionTime,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    console.error('❌ [Login Tracking] Unexpected error:', error);
    
    // Return success even on error - don't block login flow
    return new Response(
      JSON.stringify({
        success: false,
        error: 'internal_error',
        message: error.message || 'Failed to track login location',
        executionTime,
        note: 'This error did not block the login flow',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
