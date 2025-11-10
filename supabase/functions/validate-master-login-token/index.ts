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

    if (userError || !targetUser || !targetUser.email) {
      console.error('❌ [validate-master-login-token] User fetch error:', userError);
      throw new Error('Target user not found');
    }

    console.log('🔐 [validate-master-login-token] Generating session tokens for user:', {
      target_user_id: session.target_user_id,
      email_masked: targetUser.email.substring(0, 3) + '***',
      token_age_seconds: Math.round((Date.now() - new Date(session.created_at).getTime()) / 1000),
      expires_in_minutes: Math.round((new Date(session.expires_at).getTime() - Date.now()) / 60000)
    });

    // Generate magic link session server-side using admin API
    const { data: magicLinkData, error: magicLinkError } = await supabaseClient.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.email
    });

    if (magicLinkError || !magicLinkData) {
      console.error('❌ [validate-master-login-token] Failed to generate magic link:', magicLinkError);
      throw new Error('Failed to generate authentication session');
    }

    // Extract hashed token from the magic link
    const hashedToken = magicLinkData.properties.hashed_token;
    
    if (!hashedToken) {
      console.error('❌ [validate-master-login-token] Missing hashed_token in magic link response');
      throw new Error('Failed to extract authentication token');
    }

    // Verify the token to get session tokens
    const { data: verifyData, error: verifyError } = await supabaseClient.auth.verifyOtp({
      token_hash: hashedToken,
      type: 'magiclink'
    });

    if (verifyError || !verifyData?.session) {
      console.error('❌ [validate-master-login-token] Failed to verify token:', verifyError);
      throw new Error('Failed to create authentication session');
    }

    const accessToken = verifyData.session.access_token;
    const refreshToken = verifyData.session.refresh_token;

    console.log('✅ [validate-master-login-token] Session tokens generated successfully');

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
        userEmail: targetUser.email,
        access_token: accessToken,
        refresh_token: refreshToken
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
