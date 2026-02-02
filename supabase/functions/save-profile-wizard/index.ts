import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BEP20_REGEX = /^0x[a-fA-F0-9]{40}$/;
function isValidBep20Address(addr: string): boolean {
  return typeof addr === 'string' && addr.length === 42 && BEP20_REGEX.test(addr.trim());
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '');
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'unauthorized', message: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const token = authHeader.replace('Bearer ', '').trim();
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'unauthorized', message: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      complete,
      first_name,
      last_name,
      country,
      timezone,
      skip_payout,
      usdt_bep20_address,
      payout_confirmation,
      phone_country_code,
      phone_number,
      preferred_language,
      earning_goal,
      motivation,
      how_did_you_hear,
      weekly_goal,
      weekly_time_commitment,
      preferred_review_categories,
      weekly_routine,
      recommended_plan_id,
      selected_plan_id,
      onboarding_version,
    } = body;

    const updates: Record<string, unknown> = {};

    if (first_name !== undefined) updates.first_name = first_name && String(first_name).trim() || null;
    if (last_name !== undefined) updates.last_name = last_name && String(last_name).trim() || null;
    if (country !== undefined) updates.country = country && String(country).trim().toUpperCase().slice(0, 2) || null;
    if (timezone !== undefined) updates.timezone = timezone && String(timezone).trim() || null;
    if (preferred_language !== undefined) updates.preferred_language = preferred_language && String(preferred_language).trim() || null;
    if (earning_goal !== undefined) updates.earning_goal = earning_goal && String(earning_goal).trim() || null;
    if (motivation !== undefined) updates.motivation = motivation && String(motivation).trim() || null;
    if (how_did_you_hear !== undefined) updates.how_did_you_hear = how_did_you_hear && String(how_did_you_hear).trim() || null;
    if (phone_country_code !== undefined) updates.phone_country_code = phone_country_code && String(phone_country_code).trim() || null;

    // New onboarding fields
    if (weekly_goal !== undefined) updates.weekly_goal = weekly_goal;
    if (weekly_time_commitment !== undefined) updates.weekly_time_commitment = weekly_time_commitment;
    if (preferred_review_categories !== undefined) updates.preferred_review_categories = preferred_review_categories;
    if (weekly_routine !== undefined) updates.weekly_routine = weekly_routine;
    if (recommended_plan_id !== undefined) updates.recommended_plan_id = recommended_plan_id;
    if (selected_plan_id !== undefined) updates.selected_plan_id = selected_plan_id;
    if (onboarding_version !== undefined) updates.onboarding_version = onboarding_version;

    if (phone_number !== undefined || phone_country_code !== undefined) {
      const cc = (updates.phone_country_code as string) ?? body.phone_country_code;
      const num = phone_number != null ? String(phone_number).trim() : '';
      if (cc && num) updates.phone = `+${String(cc).replace(/^\+/, '')}${num}`;
      else if (phone_number !== undefined && !num) updates.phone = null;
    }

    if (complete === true) {
      updates.profile_completed = true;
      updates.profile_completed_at = new Date().toISOString();
      updates.onboarding_completed_at = new Date().toISOString();
    }

    if (skip_payout !== true && usdt_bep20_address != null && String(usdt_bep20_address).trim()) {
      const addr = String(usdt_bep20_address).trim();
      if (!isValidBep20Address(addr)) {
        return new Response(
          JSON.stringify({ error: 'validation_error', message: 'Invalid USDT BEP20 address. Must be 0x followed by 40 hex characters.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (payout_confirmation !== true) {
        return new Response(
          JSON.stringify({ error: 'validation_error', message: 'You must confirm the address is a USDT BEP20 (BSC) address.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      updates.usdt_bep20_address = addr;
      updates.payout_configured = true;
      updates.withdrawal_addresses_updated_at = new Date().toISOString();
    }

    if (Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No updates to apply.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (updateError) {
      console.error('Update failed:', updateError);
      return new Response(
        JSON.stringify({ 
          error: 'update_failed', 
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, profile_completed: !!updates.profile_completed }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'internal_error', message: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
