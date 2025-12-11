import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }
    // Check admin role
    const { data: adminRole } = await supabaseClient.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!adminRole) {
      throw new Error('Admin access required');
    }
    const configData = await req.json();
    console.log(`Admin ${user.id} updating referral system configuration`);
    // Validate signup bonus amount (must be non-negative)
    if (configData.signup_bonus_amount !== undefined) {
      if (configData.signup_bonus_amount < 0) {
        throw new Error('Signup bonus amount must be non-negative');
      }
    }
    // Get current configuration for audit log
    const { data: currentConfig, error: fetchError } = await supabaseClient.from('referral_program_config').select('*').maybeSingle();
    if (fetchError) {
      console.error('Error fetching current config:', fetchError);
    }
    // Update or insert configuration (upsert)
    // If config doesn't exist, create it; otherwise update
    let updatedConfig;
    if (currentConfig) {
      const { data, error: updateError } = await supabaseClient.from('referral_program_config').update(configData).eq('id', currentConfig.id).select().single();
      if (updateError) {
        throw new Error(`Failed to update referral configuration: ${updateError.message}`);
      }
      updatedConfig = data;
    } else {
      const { data, error: insertError } = await supabaseClient.from('referral_program_config').insert(configData).select().single();
      if (insertError) {
        throw new Error(`Failed to create referral configuration: ${insertError.message}`);
      }
      updatedConfig = data;
    }
    // Log to audit_logs
    await supabaseClient.from('audit_logs').insert({
      admin_id: user.id,
      action_type: 'referral_config_update',
      details: {
        old_values: currentConfig || {},
        new_values: configData,
        updated_fields: Object.keys(configData)
      }
    });
    console.log('Referral system configuration updated successfully');
    return new Response(JSON.stringify({
      success: true,
      config: updatedConfig,
      message: 'Referral system configuration updated successfully'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in configure-referral-system:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: error.message === 'Unauthorized' || error.message === 'Admin access required' ? 403 : 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
