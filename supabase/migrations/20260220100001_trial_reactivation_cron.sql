-- Schedule daily cron for trial reactivation at 6:00 UTC.
-- URL and auth use app.settings (same pattern as process-daily-tasks-reminder).

DO $$
BEGIN
  PERFORM cron.unschedule('process-trial-reactivation-daily');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'process-trial-reactivation-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(
      NULLIF(trim(current_setting('app.settings.supabase_url', true)), ''),
      'https://vrbtmbaqhhxwesqbcywm.supabase.co'
    ) || '/functions/v1/process-trial-reactivation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(current_setting('app.settings.service_role_key', true), current_setting('app.settings.anon_key', true), '')
    ),
    body := '{"scheduled": true}'::jsonb
  ) AS request_id;
  $$
);
