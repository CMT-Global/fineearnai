import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { sendTemplateEmail } from '../_shared/email-sender.ts';
import { getDefaultPlanName } from '../_shared/cache.ts';

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 300;

const SCHEDULE_DAYS_TO_STEP: Record<number, number> = {
  0: 1,
  1: 2,
  3: 3,
  5: 4,
  7: 5,
  10: 6,
  14: 7,
};

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

/** Days between two UTC date strings (date-only) */
function daysBetween(dateStrStart: string, dateStrEnd: string): number {
  const start = new Date(dateStrStart + 'T00:00:00Z').getTime();
  const end = new Date(dateStrEnd + 'T00:00:00Z').getTime();
  return Math.floor((end - start) / (24 * 60 * 60 * 1000));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] process-trial-reactivation invoked`);

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
      .eq('key', 'trial_reactivation_campaign')
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
      send_time_utc?: string;
      require_email_verified?: boolean;
      plan_price_from?: string | number;
    }) || {};
    if (config.enabled !== true) {
      console.log(`[${requestId}] Campaign disabled, skipping`);
      return new Response(
        JSON.stringify({ run: false, reason: 'campaign_disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawSendTime = String(config.send_time_utc || '06:00').trim();
    const [hPart] = rawSendTime.split(':');
    const configHour = Math.min(23, Math.max(0, parseInt(hPart, 10) || 0));
    const now = new Date();
    const currentHour = now.getUTCHours();

    if (!forceRun) {
      if (currentHour !== configHour) {
        console.log(`[${requestId}] Not send time (configured UTC hour ${configHour}, current ${currentHour})`);
        return new Response(
          JSON.stringify({ run: false, reason: 'not_send_time' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const todayUtc = toUtcDateString(now);
      const { data: existingLog } = await supabase
        .from('trial_reactivation_logs')
        .select('id')
        .eq('run_date', todayUtc)
        .limit(1)
        .maybeSingle();

      if (existingLog) {
        console.log(`[${requestId}] Already ran today (${todayUtc}), skipping`);
        return new Response(
          JSON.stringify({ run: false, reason: 'already_ran_today' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const todayUtc = toUtcDateString(now);
    const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

    const defaultPlanName = await getDefaultPlanName(supabase);
    if (!defaultPlanName) {
      console.error(`[${requestId}] Default (free) plan not found`);
      return new Response(
        JSON.stringify({ run: false, reason: 'config_error', error: 'Default plan not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requireEmailVerified = config.require_email_verified !== false;
    const planPriceFrom = String(config.plan_price_from ?? '48');

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
    const platformName = (platformBranding?.name as string) || 'ProfitChips';
    const loginUrl = `${platformUrl.replace(/\/$/, '')}/login`;
    const upgradeUrl = `${platformUrl.replace(/\/$/, '')}/plans`;
    const helpCenterUrl = `${platformUrl.replace(/\/$/, '')}/support`;

    let query = supabase
      .from('profiles')
      .select('id, email, full_name, username, plan_expires_at')
      .eq('account_status', 'expired')
      .eq('membership_plan', defaultPlanName)
      .not('email', 'is', null);
    if (requireEmailVerified) {
      query = query.eq('email_verified', true);
    }
    const { data: expiredProfiles, error: profilesError } = await query;

    if (profilesError) {
      console.error(`[${requestId}] Failed to fetch expired profiles:`, profilesError);
      return new Response(
        JSON.stringify({ run: false, reason: 'query_error', error: profilesError.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const eligibleProfiles = (expiredProfiles || []).filter((p) => p.email && p.email.includes('@'));
    if (eligibleProfiles.length === 0) {
      await supabase.from('trial_reactivation_logs').insert({
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

    const userIds = eligibleProfiles.map((p) => p.id);
    const { data: sequenceRows } = await supabase
      .from('trial_reactivation_sequence')
      .select('user_id, expiry_date, last_step_sent, last_sent_at, status')
      .in('user_id', userIds);

    const sequenceByUser = new Map<string, { expiry_date: string; last_step_sent: number; last_sent_at: string | null; status: string }>();
    for (const row of sequenceRows || []) {
      if (row.status !== 'active') continue;
      sequenceByUser.set(row.user_id, {
        expiry_date: row.expiry_date,
        last_step_sent: row.last_step_sent ?? 0,
        last_sent_at: row.last_sent_at ?? null,
        status: row.status,
      });
    }

    type ToSend = { profile: (typeof eligibleProfiles)[0]; step: number; expiryDate: string };
    const toSend: ToSend[] = [];

    for (const profile of eligibleProfiles) {
      const seq = sequenceByUser.get(profile.id);
      const planExpiresAt = profile.plan_expires_at;
      if (!planExpiresAt) continue;

      const expiryDate = seq ? seq.expiry_date : toUtcDateString(new Date(planExpiresAt));
      const lastStepSent = seq ? seq.last_step_sent : 0;
      const lastSentAt = seq ? seq.last_sent_at : null;

      if (lastStepSent >= 7) continue;

      const daysSinceExpiry = daysBetween(expiryDate, todayUtc);
      if (daysSinceExpiry < 0) continue;

      const step = SCHEDULE_DAYS_TO_STEP[daysSinceExpiry];
      if (step == null || step <= lastStepSent) continue;

      if (lastSentAt && new Date(lastSentAt).getTime() >= startOfTodayUtc.getTime()) continue;

      toSend.push({ profile, step, expiryDate });
    }

    console.log(`[${requestId}] Eligible: ${eligibleProfiles.length}, due today: ${toSend.length}`);

    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < toSend.length; i += BATCH_SIZE) {
      const batch = toSend.slice(i, i + BATCH_SIZE);
      for (const { profile, step, expiryDate } of batch) {
        const firstName = getFirstName(profile.full_name ?? null, profile.username ?? null);
        const templateType = `trial_reactivation_${step}` as const;
        const result = await sendTemplateEmail({
          templateType,
          recipientEmail: profile.email!,
          recipientUserId: profile.id,
          variables: {
            first_name: firstName,
            login_url: loginUrl,
            upgrade_url: upgradeUrl,
            help_center_url: helpCenterUrl,
            plan_price_from: planPriceFrom,
            platform_name: platformName,
          },
          supabaseClient: supabase,
        });

        if (result.success) {
          sentCount++;
          const isCompleted = step === 7;
          const nowIso = new Date().toISOString();
          const { error: upsertErr } = await supabase.from('trial_reactivation_sequence').upsert(
            {
              user_id: profile.id,
              expiry_date: expiryDate,
              last_step_sent: step,
              last_sent_at: nowIso,
              status: isCompleted ? 'completed' : 'active',
              updated_at: nowIso,
            },
            { onConflict: 'user_id' }
          );
          if (upsertErr) {
            console.error(`[${requestId}] Failed to upsert sequence for ${profile.id}:`, upsertErr);
          }
        } else {
          failedCount++;
        }
      }
      if (i + BATCH_SIZE < toSend.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    await supabase.from('trial_reactivation_logs').insert({
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
