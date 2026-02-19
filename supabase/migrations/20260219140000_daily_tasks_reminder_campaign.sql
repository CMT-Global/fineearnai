-- Daily Tasks Reminder: logs table, campaign config, email template seed, cron job
-- =============================================================================

-- 1. Create daily_tasks_reminder_logs table
CREATE TABLE IF NOT EXISTS public.daily_tasks_reminder_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_date DATE NOT NULL,
  total_eligible INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_reminder_logs_run_date
  ON public.daily_tasks_reminder_logs (run_date DESC);

-- Enable RLS
ALTER TABLE public.daily_tasks_reminder_logs ENABLE ROW LEVEL SECURITY;

-- Policy: admins can read only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_tasks_reminder_logs'
      AND policyname = 'Admins can view daily tasks reminder logs'
  ) THEN
    CREATE POLICY "Admins can view daily tasks reminder logs"
    ON public.daily_tasks_reminder_logs
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- 2. Seed campaign config in platform_config (do not overwrite if key exists)
INSERT INTO public.platform_config (key, value, description, updated_at)
VALUES (
  'daily_tasks_reminder_campaign',
  '{"enabled": false, "send_time_utc": "06:00"}'::jsonb,
  'Daily Tasks Reminder email campaign: enabled, send_time_utc (HH:mm)',
  now()
)
ON CONFLICT (key) DO NOTHING;

-- 3. Seed email template (idempotent: insert only if no template with this type exists)
INSERT INTO public.email_templates (
  name,
  subject,
  body,
  template_type,
  variables,
  is_active,
  updated_at
)
SELECT
  'Daily Tasks Reminder',
  'New tasks are ready for you today ✅',
  '<p>Hi {{first_name}},</p>
<p>New tasks have already been assigned to your <strong>{{platform_name}}</strong> account for today.</p>
<p>Log in now to start completing tasks and keep your daily progress moving:</p>
<p><a href="{{login_url}}">{{login_url}}</a></p>
<p>Quick reminder: Your task access depends on having an active account. If you''d like higher earning potential and uninterrupted access, you can upgrade anytime — plans start from $48/year.<br/>Upgrade here: <a href="{{upgrade_url}}">{{upgrade_url}}</a></p>
<p>Need help? Visit our <a href="{{help_center_url}}">Help Center</a> or talk to us on LiveChat.</p>
<p>— {{platform_name}} Team</p>
<p><a href="{{platform_url}}">{{platform_url}}</a><br/>{{support_email}}</p>',
  'daily_tasks_reminder',
  '["first_name", "login_url", "upgrade_url", "help_center_url", "platform_name", "platform_url", "support_email"]'::jsonb,
  true,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE template_type = 'daily_tasks_reminder'
);

-- 4. Schedule hourly cron to trigger process-daily-tasks-reminder (runs at minute 0 every hour UTC)
-- Note: 20260219150000_fix_daily_tasks_reminder_cron_auth.sql replaces this with app.settings (URL + service_role_key)
DO $$
BEGIN
  PERFORM cron.unschedule('process-daily-tasks-reminder-hourly');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'process-daily-tasks-reminder-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mobikymhzchzakwzpqep.supabase.co/functions/v1/process-daily-tasks-reminder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vYmlreW1oemNoemFrd3pwcWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NTIzODcsImV4cCI6MjA3NTQyODM4N30.XWSL-ZIzX2DRp5lO7lYnj7L3Cns2z2g3OGdtb8JhDRc"}'::jsonb,
    body := '{"scheduled": true}'::jsonb
  ) AS request_id;
  $$
);
