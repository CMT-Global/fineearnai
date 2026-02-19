-- Fix Daily Tasks Reminder cron: call Edge Function every hour at :00 UTC.
-- URL: uses app.settings.supabase_url if set, else fallback for this project (see config.toml project_id).
-- Auth: app.settings.service_role_key MUST be set or the cron request will fail.
-- Run RUN_IN_DASHBOARD_set_daily_tasks_reminder_cron.sql once in SQL Editor to set these.

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
    url := COALESCE(
      NULLIF(trim(current_setting('app.settings.supabase_url', true)), ''),
      'https://vrbtmbaqhhxwesqbcywm.supabase.co'
    ) || '/functions/v1/process-daily-tasks-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(current_setting('app.settings.service_role_key', true), current_setting('app.settings.anon_key', true), '')
    ),
    body := '{"scheduled": true}'::jsonb
  ) AS request_id;
  $$
);
