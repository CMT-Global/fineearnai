import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { sendTemplateEmail } from '../_shared/email-sender.ts';

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 300;

interface StepConfig {
  step_index: number;
  day_offset: number;
  template_type: string;
  is_active: boolean;
}

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  referral_code: string | null;
  account_status: string;
  email_verified: boolean | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFirstName(fullName: string | null, username: string | null): string {
  if (fullName && fullName.trim()) {
    const first = fullName.trim().split(/\s+/)[0];
    if (first) return first;
  }
  if (username && username.trim()) return username.trim();
  return 'there';
}

/** UTC date string YYYY-MM-DD from a Date */
function toUtcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Add days to a UTC date string, return YYYY-MM-DD */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] process-post-upgrade-team-commissions invoked`);

  let body: { scheduled?: boolean; force_run?: boolean } = {};
  try {
    body = (await req.json().catch(() => ({}))) as typeof body;
  } catch {
    // ignore
  }
  const forceRun = body.force_run === true;

  if (forceRun) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ run: false, reason: 'unauthorized', error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(
      authHeader.replace(/^Bearer\s+/i, '').trim()
    );
    if (userError || !user?.id) {
      return new Response(
        JSON.stringify({ run: false, reason: 'unauthorized', error: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const supabaseAuth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: adminRow } = await supabaseAuth
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!adminRow) {
      return new Response(
        JSON.stringify({ run: false, reason: 'forbidden', error: 'Admin required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: configRow, error: configError } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'post_upgrade_team_commissions_campaign')
      .maybeSingle();

    if (configError) {
      console.error(`[${requestId}] Failed to load campaign config:`, configError);
      return new Response(
        JSON.stringify({ run: false, reason: 'config_error', error: configError.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = (configRow?.value as {
      enabled?: boolean;
      require_email_verified?: boolean;
      send_time_utc?: string;
      steps?: StepConfig[];
    }) || {};
    if (config.enabled !== true) {
      console.log(`[${requestId}] Campaign disabled, skipping`);
      return new Response(
        JSON.stringify({ run: false, reason: 'campaign_disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stepsRaw = Array.isArray(config.steps) ? config.steps : [];
    const activeSteps: StepConfig[] = stepsRaw
      .filter((s) => s && s.is_active !== false && s.template_type)
      .sort((a, b) => (a.day_offset ?? 0) - (b.day_offset ?? 0));
    if (activeSteps.length === 0) {
      console.log(`[${requestId}] No active steps configured`);
      return new Response(
        JSON.stringify({ run: false, reason: 'no_steps' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const maxStepIndex = Math.max(...activeSteps.map((s) => s.step_index ?? 0));
    const rawSendTime = String(config.send_time_utc || '09:00').trim();
    const [hPart, mPart] = rawSendTime.split(':');
    const configHour = Math.min(23, Math.max(0, parseInt(hPart, 10) || 0));
    const configMinute = Math.min(59, Math.max(0, parseInt(mPart, 10) || 0));
    const now = new Date();
    const todayUtc = toUtcDateString(now);
    const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const sendTimeToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), configHour, configMinute, 0, 0));
    const requireEmailVerified = config.require_email_verified !== false;

    if (!forceRun && now.getTime() < sendTimeToday.getTime()) {
      console.log(`[${requestId}] Before send time today (${rawSendTime} UTC), skipping`);
      return new Response(
        JSON.stringify({ run: false, reason: 'before_send_time' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: configData } = await supabase
      .from('platform_config')
      .select('key, value')
      .in('key', ['email_settings', 'platform_branding']);
    const emailSettings = (configData?.find((c) => c.key === 'email_settings')?.value as Record<string, unknown>) || {};
    const platformBranding = (configData?.find((c) => c.key === 'platform_branding')?.value as Record<string, unknown>) || {};
    const platformUrl =
      (platformBranding?.url as string) ||
      (emailSettings?.platform_url as string) ||
      'https://profitchips.com';
    const teamGuideUrl = `${platformUrl.replace(/\/$/, '')}/how-it-works`;

    const { data: enrollments, error: enrollError } = await supabase
      .from('post_upgrade_team_commissions_enrollment')
      .select('user_id, upgraded_at, current_step, last_sent_at, step_sent_map, status')
      .eq('status', 'active');

    if (enrollError) {
      console.error(`[${requestId}] Failed to fetch enrollments:`, enrollError);
      return new Response(
        JSON.stringify({ run: false, reason: 'query_error', error: enrollError.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const enrollmentList = enrollments || [];
    if (enrollmentList.length === 0) {
      await supabase.from('post_upgrade_team_commissions_logs').insert({
        run_date: todayUtc,
        total_eligible: 0,
        sent_count: 0,
        failed_count: 0,
        run_at: new Date().toISOString(),
      });
      return new Response(
        JSON.stringify({ run: true, total_eligible: 0, sent_count: 0, failed_count: 0, run_at: new Date().toISOString() }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userIds = enrollmentList.map((e) => e.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, username, referral_code, account_status, email_verified')
      .in('id', userIds);

    if (profilesError) {
      console.error(`[${requestId}] Failed to fetch profiles:`, profilesError);
      return new Response(
        JSON.stringify({ run: false, reason: 'query_error', error: profilesError.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const profileById = new Map<string, ProfileRow>((profiles || []).map((p: ProfileRow) => [p.id, p]));

    type ToSend = {
      enrollment: (typeof enrollmentList)[0];
      profile: { id: string; email: string; full_name: string | null; username: string | null; referral_code: string | null };
      step: StepConfig;
    };
    const toSend: ToSend[] = [];

    for (const enrollment of enrollmentList) {
      const profile = profileById.get(enrollment.user_id);
      if (!profile || !profile.email || !profile.email.includes('@')) continue;
      if (profile.account_status !== 'active') continue;
      if (requireEmailVerified && !profile.email_verified) continue;

      const upgradedAt = enrollment.upgraded_at;
      const upgradedDateStr = upgradedAt.slice(0, 10);
      const currentStep = enrollment.current_step ?? 0;
      const lastSentAt = enrollment.last_sent_at ?? null;
      if (lastSentAt && new Date(lastSentAt).getTime() >= startOfTodayUtc.getTime()) continue;
      if (currentStep >= maxStepIndex) continue;

      for (const step of activeSteps) {
        if ((step.step_index ?? 0) <= currentStep) continue;
        const dueDateStr = addDays(upgradedDateStr, step.day_offset ?? 0);
        if (dueDateStr > todayUtc) continue;
        toSend.push({
          enrollment,
          profile: {
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name ?? null,
            username: profile.username ?? null,
            referral_code: profile.referral_code ?? null,
          },
          step,
        });
        break;
      }
    }

    console.log(`[${requestId}] Active enrollments: ${enrollmentList.length}, due this run: ${toSend.length}`);

    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < toSend.length; i += BATCH_SIZE) {
      const batch = toSend.slice(i, i + BATCH_SIZE);
      for (const { enrollment, profile, step } of batch) {
        const firstName = getFirstName(profile.full_name, profile.username);
        const teamInviteUrl = profile.referral_code
          ? `${platformUrl.replace(/\/$/, '')}/signup?ref=${encodeURIComponent(profile.referral_code)}`
          : `${platformUrl.replace(/\/$/, '')}/referrals`;

        const result = await sendTemplateEmail({
          templateType: step.template_type,
          recipientEmail: profile.email,
          recipientUserId: profile.id,
          variables: {
            first_name: firstName,
            team_invite_url: teamInviteUrl,
            team_guide_url: teamGuideUrl,
          },
          supabaseClient: supabase,
        });

        if (result.success) {
          sentCount++;
          const newStep = step.step_index ?? 0;
          const stepSentMap = (enrollment.step_sent_map as Record<string, string>) || {};
          stepSentMap[String(newStep)] = new Date().toISOString();
          const isCompleted = newStep >= maxStepIndex;
          const nowIso = new Date().toISOString();
          await supabase
            .from('post_upgrade_team_commissions_enrollment')
            .update({
              current_step: newStep,
              last_sent_at: nowIso,
              step_sent_map: stepSentMap,
              status: isCompleted ? 'completed' : 'active',
              updated_at: nowIso,
            })
            .eq('user_id', enrollment.user_id);
        } else {
          failedCount++;
        }
      }
      if (i + BATCH_SIZE < toSend.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    await supabase.from('post_upgrade_team_commissions_logs').insert({
      run_date: todayUtc,
      total_eligible: toSend.length,
      sent_count: sentCount,
      failed_count: failedCount,
      run_at: new Date().toISOString(),
    });

    console.log(`[${requestId}] Done. sent=${sentCount}, failed=${failedCount}`);

    return new Response(
      JSON.stringify({
        run: true,
        total_eligible: toSend.length,
        sent_count: sentCount,
        failed_count: failedCount,
        run_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(`[${requestId}] Error:`, err);
    return new Response(
      JSON.stringify({
        run: false,
        reason: 'error',
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
