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

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: adminUser } } = await supabaseClient.auth.getUser(token);

    if (!adminUser) {
      throw new Error('Unauthorized');
    }

    // Check admin role
    const { data: adminRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', adminUser.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!adminRole) {
      throw new Error('Admin access required');
    }

    const { userId } = await req.json();

    if (!userId) {
      throw new Error('User ID is required');
    }

    // Generate random token
    const oneTimeToken = crypto.randomUUID() + '-' + Date.now();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Create master login session
    const { error: sessionError } = await supabaseClient
      .from('master_login_sessions')
      .insert({
        admin_id: adminUser.id,
        target_user_id: userId,
        one_time_token: oneTimeToken,
        expires_at: expiresAt.toISOString()
      });

    if (sessionError) throw sessionError;

    // Create audit log
    await supabaseClient
      .from('audit_logs')
      .insert({
        admin_id: adminUser.id,
        action_type: 'master_login_generated',
        target_user_id: userId,
        details: {
          expires_at: expiresAt.toISOString()
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true,
        token: oneTimeToken,
        expiresAt: expiresAt.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});