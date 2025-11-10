import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { token } = await req.json();

    if (!token) {
      throw new Error('Token is required');
    }

    console.log('🔍 [validate-master-login-token] Validating token:', token);

    // Find the master login session
    const { data: session, error: sessionError } = await supabaseClient
      .from('master_login_sessions')
      .select('*')
      .eq('one_time_token', token)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (sessionError) {
      console.error('❌ [validate-master-login-token] Session query error:', sessionError);
      throw sessionError;
    }

    if (!session) {
      console.log('⚠️ [validate-master-login-token] Invalid, expired, or already used token');
      throw new Error('Invalid, expired, or already used token');
    }

    console.log('✅ [validate-master-login-token] Valid session found:', session.id);

    // Get the target user's email
    const { data: { user: targetUser }, error: userError } = await supabaseClient.auth.admin.getUserById(
      session.target_user_id
    );

    if (userError || !targetUser) {
      console.error('❌ [validate-master-login-token] User fetch error:', userError);
      throw new Error('Target user not found');
    }

    // Mark the token as used
    const { error: updateError } = await supabaseClient
      .from('master_login_sessions')
      .update({ used_at: new Date().toISOString() })
      .eq('id', session.id);

    if (updateError) {
      console.error('❌ [validate-master-login-token] Failed to mark token as used:', updateError);
    }

    // Create audit log entry
    await supabaseClient
      .from('audit_logs')
      .insert({
        admin_id: session.admin_id,
        action_type: 'master_login_used',
        target_user_id: session.target_user_id,
        details: {
          method: 'one_time_token',
          timestamp: new Date().toISOString(),
          token_id: session.id
        }
      });

    console.log('✅ [validate-master-login-token] Token validated successfully for user:', targetUser.email);

    return new Response(
      JSON.stringify({
        success: true,
        userId: session.target_user_id,
        userEmail: targetUser.email
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ [validate-master-login-token] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
