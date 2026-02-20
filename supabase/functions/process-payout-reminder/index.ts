import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { sendTemplateEmail } from '../_shared/email-sender.ts';

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 300;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

interface PayoutScheduleDay {
  day: number;
  enabled: boolean;
  start_time: string;
  end_time: string;
}

/** Get next occurrence of a weekday (0-6) at or after the given date, as YYYY-MM-DD. If today is that day, returns next week's date so we only consider future payout days. */
function getNextDateForDay(from: Date, dayOfWeek: number): string {
  const fromUtc = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  let d = fromUtc.getUTCDay();
  let daysToAdd = (dayOfWeek - d + 7) % 7;
  if (daysToAdd === 0) daysToAdd = 7;
  const next = new Date(fromUtc);
  next.setUTCDate(next.getUTCDate() + daysToAdd);
  return next.toISOString().slice(0, 10);
}

/** Hours from now until the start of the given date (00:00 UTC) */
function hoursUntilDate(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const payoutStart = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  return (payoutStart - Date.now()) / (1000 * 60 * 60);
}

/** Template type for a given hours_before (only 48 and 24 have templates) */
function templateTypeForHours(hoursBefore: number): string | null {
  if (hoursBefore === 48) return 'payout_reminder_48h';
  if (hoursBefore === 24) return 'payout_reminder_24h';
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] process-payout-reminder invoked`);

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
      .eq('key', 'payout_reminder_campaign')
      .maybeSingle();

    if (configError) {
      console.error(`[${requestId}] Failed to load campaign config:`, configError);
      return new Response(
        JSON.stringify({ run: false, reason: 'config_error', error: configError.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = (configRow?.value as { enabled?: boolean; reminder_hours?: number[]; send_time_utc?: string }) || {};
    if (config.enabled !== true) {
      console.log(`[${requestId}] Campaign disabled, skipping`);
      return new Response(
        JSON.stringify({ run: false, reason: 'campaign_disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const reminderHours: number[] = Array.isArray(config.reminder_hours) ? config.reminder_hours : [48, 24];
    const rawSendTime = String(config.send_time_utc || '06:00').trim();
    const [hPart] = rawSendTime.split(':');
    const configHour = Math.min(23, Math.max(0, parseInt(hPart, 10) || 0));
    const now = new Date();
    const currentHour = now.getUTCHours();

    if (!forceRun && currentHour !== configHour) {
      console.log(`[${requestId}] Not send time (configured UTC hour ${configHour}, current ${currentHour})`);
      return new Response(
        JSON.stringify({ run: false, reason: 'not_send_time' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: scheduleRow, error: scheduleError } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'payout_schedule')
      .maybeSingle();

    if (scheduleError || !scheduleRow?.value) {
      console.log(`[${requestId}] No payout schedule or error:`, scheduleError?.message);
      return new Response(
        JSON.stringify({ run: false, reason: 'no_schedule' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const schedule = scheduleRow.value as PayoutScheduleDay[];
    const enabledDays = schedule.filter((s) => s.enabled).map((s) => s.day);
    if (enabledDays.length === 0) {
      console.log(`[${requestId}] No enabled payout days`);
      return new Response(
        JSON.stringify({ run: false, reason: 'no_enabled_days' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const todayStr = now.toISOString().slice(0, 10);
    const tasks: { payout_date: string; hours_before: number; payout_day_name: string }[] = [];

    for (const dayOfWeek of enabledDays) {
      const payoutDateStr = getNextDateForDay(now, dayOfWeek);
      const hoursUntil = hoursUntilDate(payoutDateStr);
      const payoutDayName = DAY_NAMES[dayOfWeek];

      for (const h of reminderHours) {
        const templateType = templateTypeForHours(h);
        if (!templateType) continue;
        if (hoursUntil > h + 1 || hoursUntil <= h - 1) continue;
        const { data: existing } = await supabase
          .from('payout_reminder_logs')
          .select('id')
          .eq('payout_date', payoutDateStr)
          .eq('hours_before', h)
          .limit(1)
          .maybeSingle();
        if (existing) continue;
        tasks.push({ payout_date: payoutDateStr, hours_before: h, payout_day_name: payoutDayName });
      }
    }

    if (tasks.length === 0) {
      console.log(`[${requestId}] No reminder tasks to send`);
      return new Response(
        JSON.stringify({ run: true, tasks_sent: 0, message: 'No reminder windows matched' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: configData } = await supabase
      .from('platform_config')
      .select('key, value')
      .in('key', ['email_settings', 'platform_branding']);
    const emailSettings = (configData?.find((c) => c.key === 'email_settings')?.value as Record<string, unknown>) || {};
    const platformBranding = (configData?.find((c) => c.key === 'platform_branding')?.value as Record<string, unknown>) || {};
    const platformName = (platformBranding?.name as string) || (emailSettings?.platform_name as string) || 'ProfitChips';

    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, full_name, username')
      .not('email', 'is', null);

    if (usersError) {
      console.error(`[${requestId}] Failed to fetch users:`, usersError);
      return new Response(
        JSON.stringify({ run: false, reason: 'query_error', error: usersError.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const eligible = (users || []).filter((u) => u.email && String(u.email).includes('@'));
    const totalEligible = eligible.length;
    console.log(`[${requestId}] Eligible users: ${totalEligible}, tasks: ${tasks.length}`);

    let totalSent = 0;
    let totalFailed = 0;

    for (const task of tasks) {
      const templateType = templateTypeForHours(task.hours_before)!;
      let sentCount = 0;
      let failedCount = 0;

      for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
        const batch = eligible.slice(i, i + BATCH_SIZE);
        for (const user of batch) {
          const firstName = getFirstName(user.full_name ?? null, user.username ?? null);
          const result = await sendTemplateEmail({
            templateType,
            recipientEmail: user.email!,
            recipientUserId: user.id,
            variables: {
              first_name: firstName,
              payout_day: task.payout_day_name,
              platform_name: platformName,
            },
            supabaseClient: supabase,
          });
          if (result.success) sentCount++;
          else failedCount++;
        }
        if (i + BATCH_SIZE < eligible.length) await sleep(BATCH_DELAY_MS);
      }

      await supabase.from('payout_reminder_logs').insert({
        payout_date: task.payout_date,
        hours_before: task.hours_before,
        total_eligible: totalEligible,
        sent_count: sentCount,
        failed_count: failedCount,
        run_at: new Date().toISOString(),
      });
      totalSent += sentCount;
      totalFailed += failedCount;
      console.log(`[${requestId}] Task ${task.payout_date} ${task.hours_before}h: sent=${sentCount}, failed=${failedCount}`);
    }

    return new Response(
      JSON.stringify({
        run: true,
        tasks_sent: tasks.length,
        total_eligible: totalEligible,
        sent_count: totalSent,
        failed_count: totalFailed,
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
