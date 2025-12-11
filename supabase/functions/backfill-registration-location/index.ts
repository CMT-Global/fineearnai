import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';
/**
 * Backfill Registration Location Data
 * 
 * One-time migration function to populate registration location fields
 * for users who were created before IPStack integration was implemented.
 * 
 * Strategy:
 * - Finds users where registration_country IS NULL
 * - But last_login_country IS NOT NULL
 * - Copies last_login location data to registration fields
 * 
 * Usage: Admin can invoke this once via Supabase function call
 */ Deno.serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('🔄 Starting registration location backfill...');
    // Find users with missing registration data but having login data
    const { data: usersToFix, error: queryError } = await supabase.from('profiles').select('id, username, email, last_login_country, last_login_country_name, last_login_ip, created_at').is('registration_country', null).not('last_login_country', 'is', null);
    if (queryError) {
      console.error('❌ Error querying users:', queryError);
      throw queryError;
    }
    console.log(`📊 Found ${usersToFix?.length || 0} users needing backfill`);
    let updated = 0;
    let errors = 0;
    const errorDetails = [];
    // Update each user
    for (const user of usersToFix || []){
      try {
        console.log(`🔄 Updating user ${user.email} (${user.username})...`);
        const { error } = await supabase.from('profiles').update({
          registration_country: user.last_login_country,
          registration_country_name: user.last_login_country_name,
          registration_ip: user.last_login_ip
        }).eq('id', user.id);
        if (error) {
          console.error(`❌ Failed to update ${user.email}:`, error);
          errors++;
          errorDetails.push({
            user_id: user.id,
            email: user.email,
            error: error.message
          });
        } else {
          console.log(`✅ Successfully updated ${user.email}`);
          updated++;
        }
      } catch (updateError) {
        console.error(`❌ Exception updating ${user.email}:`, updateError);
        errors++;
        errorDetails.push({
          user_id: user.id,
          email: user.email,
          error: updateError.message
        });
      }
    }
    const result = {
      success: true,
      message: `Backfill complete: ${updated} users updated, ${errors} errors`,
      statistics: {
        total_users_found: usersToFix?.length || 0,
        successfully_updated: updated,
        errors: errors,
        success_rate: usersToFix?.length ? `${(updated / usersToFix.length * 100).toFixed(2)}%` : '0%'
      },
      error_details: errorDetails.length > 0 ? errorDetails : undefined,
      timestamp: new Date().toISOString()
    };
    console.log('📊 Final statistics:', result.statistics);
    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('❌ Critical error in backfill function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
