import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_STEPS = [1, 2, 3, 4, 5, 6];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !user?.email) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: adminRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (roleError || !adminRole) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { step?: number; test_email?: string };
    const step = typeof body?.step === 'number' && VALID_STEPS.includes(body.step) ? body.step : 1;
    const toEmail = (body?.test_email && body.test_email.includes('@')) ? body.test_email : user.email;

    const templateType = `post_upgrade_team_${step}`;

    const { data: configData } = await supabaseAdmin
      .from('platform_config')
      .select('key, value')
      .in('key', ['email_settings', 'platform_branding']);
    const emailSettings = (configData?.find((c) => c.key === 'email_settings')?.value as Record<string, unknown>) || {};
    const platformBranding = (configData?.find((c) => c.key === 'platform_branding')?.value as Record<string, unknown>) || {};
    const platformUrl =
      (platformBranding?.url as string) ||
      (emailSettings?.platform_url as string) ||
      'https://profitchips.com';
    const teamInviteUrl = `${platformUrl.replace(/\/$/, '')}/signup?ref=SAMPLE`;
    const teamGuideUrl = `${platformUrl.replace(/\/$/, '')}/how-it-works`;

    const { data, error } = await supabaseAdmin.functions.invoke('send-template-email', {
      body: {
        email: toEmail,
        template_type: templateType,
        variables: {
          first_name: 'there',
          team_invite_url: teamInviteUrl,
          team_guide_url: teamGuideUrl,
        },
      },
    });

    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (data?.success === false) {
      return new Response(
        JSON.stringify({ success: false, error: data.error ?? 'Send failed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ success: true, message: `Test email (step ${step}) sent to ${toEmail}` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
