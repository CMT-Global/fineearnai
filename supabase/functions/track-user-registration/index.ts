import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { getLocationFromIP, extractClientIP } from '../_shared/ipstack.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Track User Registration - IPStack Integration (Phase 4)
 * 
 * Purpose: Capture and store user's IP and country information at registration time
 * Called by: Signup flow immediately after successful auth.signUp
 * 
 * Flow:
 * 1. Extract client IP from request headers
 * 2. Call IPStack API to get country information
 * 3. Update profiles table with registration location data
 * 4. Auto-populate country field if empty
 * 5. Log activity for audit trail
 * 
 * CRITICAL: Never blocks signup flow - failures are logged but ignored
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
      console.error('❌ Missing userId in request');
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

    console.log(`🚀 [Registration Tracking] Started for user: ${userId}`);

    // Extract client IP from headers
    const clientIP = extractClientIP(req);
    
    if (!clientIP) {
      console.warn(`⚠️ [Registration Tracking] Could not extract IP for user ${userId}`);
      
      // Log activity without location data
      await supabase
        .from('user_activity_log')
        .insert({
          user_id: userId,
          activity_type: 'registration',
          details: {
            note: 'IP extraction failed',
            timestamp: new Date().toISOString(),
          },
        });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Registration logged without location data',
          hasLocation: false,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`🔍 [Registration Tracking] Extracted IP: ${clientIP}`);

    // Get location from IPStack
    const locationData = await getLocationFromIP(clientIP);
    
    if (!locationData) {
      console.warn(`⚠️ [Registration Tracking] IPStack lookup failed for ${clientIP}`);
      
      // Update profile with IP only (no country data)
      await supabase
        .from('profiles')
        .update({
          registration_ip: clientIP,
        })
        .eq('id', userId);

      // Log activity with IP but no location
      await supabase
        .from('user_activity_log')
        .insert({
          user_id: userId,
          activity_type: 'registration',
          ip_address: clientIP,
          details: {
            note: 'Location lookup failed',
            timestamp: new Date().toISOString(),
          },
        });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Registration logged with IP only',
          hasLocation: false,
          ip: clientIP,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`✅ [Registration Tracking] Location found: ${locationData.country_name} (${locationData.country_code})`);

    // Fetch current profile to check if country field is empty
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('country')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error(`❌ [Registration Tracking] Failed to fetch profile:`, profileError);
    }

    // Prepare update data
    const updateData: any = {
      registration_ip: clientIP,
      registration_country: locationData.country_code,
      registration_country_name: locationData.country_name,
    };

    // Auto-populate country field if empty
    if (!profile?.country) {
      updateData.country = locationData.country_code;
      console.log(`📝 [Registration Tracking] Auto-populating country field: ${locationData.country_code}`);
    }

    // Update profile with registration location
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (updateError) {
      console.error(`❌ [Registration Tracking] Failed to update profile:`, updateError);
      throw updateError;
    }

    // Log activity with full details
    const { error: logError } = await supabase
      .from('user_activity_log')
      .insert({
        user_id: userId,
        activity_type: 'registration',
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
      console.error(`❌ [Registration Tracking] Failed to log activity:`, logError);
      // Don't throw - profile update succeeded
    }

    const executionTime = Date.now() - startTime;
    console.log(`✅ [Registration Tracking] Completed for ${userId} in ${executionTime}ms`);
    console.log(`📊 [Registration Tracking] Data: ${locationData.country_name} (${locationData.country_code}) | IP: ${clientIP}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Registration location tracked successfully',
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
    console.error('❌ [Registration Tracking] Unexpected error:', error);
    
    // Return success even on error - don't block signup flow
    return new Response(
      JSON.stringify({
        success: false,
        error: 'internal_error',
        message: error.message || 'Failed to track registration location',
        executionTime,
        note: 'This error did not block the signup flow',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
