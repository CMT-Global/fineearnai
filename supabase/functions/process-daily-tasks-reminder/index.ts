import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { sendTemplateEmail } from '../_shared/email-sender.ts';

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 300;

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] process-daily-tasks-reminder invoked`);

  let body: { scheduled?: boolean; force_run?: boolean } = {};
  try {
    body = (await req.json().catch(() => ({}))) as typeof body;
  } catch {
    // ignore
  }
  const forceRun = body.force_run === true;

  // When manually triggered (force_run), require admin auth
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

    // 1. Load campaign config
    const { data: configRow, error: configError } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'daily_tasks_reminder_campaign')
      .maybeSingle();

    if (configError) {
      console.error(`[${requestId}] Failed to load campaign config:`, configError);
      return new Response(
        JSON.stringify({ run: false, reason: 'config_error', error: configError.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = (configRow?.value as { enabled?: boolean; send_time_utc?: string; recipient_type?: string }) || {};
    if (config.enabled !== true) {
      console.log(`[${requestId}] Campaign disabled, skipping`);
      return new Response(
        JSON.stringify({ run: false, reason: 'campaign_disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse send_time_utc robustly: "HH:mm" or "H:mm" in 24h UTC (e.g. "06:00", "5:09")
    const rawSendTime = String(config.send_time_utc || '06:00').trim();
    const [hPart, mPart] = rawSendTime.split(':');
    const configHour = Math.min(23, Math.max(0, parseInt(hPart, 10) || 0));
    const recipientType = config.recipient_type === 'admins' ? 'admins' : 'all_users';
    const now = new Date();
    const currentHour = now.getUTCHours();

    if (!forceRun) {
      if (currentHour !== configHour) {
        console.log(`[${requestId}] Not send time (configured UTC hour ${configHour}, current UTC hour ${currentHour})`);
        return new Response(
          JSON.stringify({ run: false, reason: 'not_send_time' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Idempotence: already ran today?
      const todayUtc = now.toISOString().slice(0, 10);
      const { data: existingLog } = await supabase
        .from('daily_tasks_reminder_logs')
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

    const todayUtc = now.toISOString().slice(0, 10);

    // 3. Platform URLs
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
    const loginUrl = `${platformUrl.replace(/\/$/, '')}/login`;
    const upgradeUrl = `${platformUrl.replace(/\/$/, '')}/plans`;
    const helpCenterUrl = `${platformUrl.replace(/\/$/, '')}/support`;

    const nowIso = new Date().toISOString();

    // 4. Eligible users: by recipient_type
    let eligible: { id: string; email: string | null; full_name: string | null; username: string | null }[];

    if (recipientType === 'admins') {
      const { data: adminRows, error: adminError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');
      if (adminError) {
        console.error(`[${requestId}] Failed to fetch admins:`, adminError);
        return new Response(
          JSON.stringify({ run: false, reason: 'query_error', error: adminError.message }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const adminIds = (adminRows || []).map((r) => r.user_id).filter(Boolean);
      if (adminIds.length === 0) {
        eligible = [];
      } else {
        const { data: users, error: usersError } = await supabase
          .from('profiles')
          .select('id, email, full_name, username')
          .in('id', adminIds)
          .eq('account_status', 'active')
          .eq('email_verified', true)
          .not('email', 'is', null)
          .or(`plan_expires_at.is.null,plan_expires_at.gt.${nowIso}`);
        if (usersError) {
          console.error(`[${requestId}] Failed to fetch admin profiles:`, usersError);
          return new Response(
            JSON.stringify({ run: false, reason: 'query_error', error: usersError.message }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        eligible = (users || []).filter((u) => u.email && u.email.includes('@'));
      }
    } else {
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id, email, full_name, username')
        .eq('account_status', 'active')
        .eq('email_verified', true)
        .not('email', 'is', null)
        .or(`plan_expires_at.is.null,plan_expires_at.gt.${nowIso}`);

      if (usersError) {
        console.error(`[${requestId}] Failed to fetch users:`, usersError);
        return new Response(
          JSON.stringify({ run: false, reason: 'query_error', error: usersError.message }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      eligible = (users || []).filter((u) => u.email && u.email.includes('@'));
    }
    const totalEligible = eligible.length;
    console.log(`[${requestId}] Eligible users: ${totalEligible}`);

    let sentCount = 0;
    let failedCount = 0;

    // 5. Batch send
    for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
      const batch = eligible.slice(i, i + BATCH_SIZE);
      for (const user of batch) {
        const firstName = getFirstName(user.full_name ?? null, user.username ?? null);
        const result = await sendTemplateEmail({
          templateType: 'daily_tasks_reminder',
          recipientEmail: user.email!,
          recipientUserId: user.id,
          variables: {
            first_name: firstName,
            login_url: loginUrl,
            upgrade_url: upgradeUrl,
            help_center_url: helpCenterUrl,
          },
          supabaseClient: supabase,
        });
        if (result.success) sentCount++;
        else failedCount++;
      }
      if (i + BATCH_SIZE < eligible.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    // 6. Log run
    await supabase.from('daily_tasks_reminder_logs').insert({
      run_date: todayUtc,
      total_eligible: totalEligible,
      sent_count: sentCount,
      failed_count: failedCount,
      run_at: new Date().toISOString(),
    });

    console.log(`[${requestId}] Done. sent=${sentCount}, failed=${failedCount}`);

    return new Response(
      JSON.stringify({
        run: true,
        total_eligible: totalEligible,
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
