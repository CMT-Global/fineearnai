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

    const { userId, updates } = await req.json();

    if (!userId || !updates) {
      throw new Error('Missing required fields');
    }

    // Get current profile for audit log
    const { data: oldProfile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Update profile
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (updateError) throw updateError;

    // Create audit log
    await supabaseClient
      .from('audit_logs')
      .insert({
        admin_id: adminUser.id,
        action_type: 'profile_update',
        target_user_id: userId,
        details: {
          old_values: oldProfile,
          new_values: updates
        }
      });

    return new Response(
      JSON.stringify({ success: true }),
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