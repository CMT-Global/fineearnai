-- Schedule hourly cron for payout day reminder (same pattern as process-daily-tasks-reminder).
-- URL and auth use app.settings (supabase_url, service_role_key).

DO $$
BEGIN
  PERFORM cron.unschedule('process-payout-reminder-hourly');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'process-payout-reminder-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(
      NULLIF(trim(current_setting('app.settings.supabase_url', true)), ''),
      'https://vrbtmbaqhhxwesqbcywm.supabase.co'
    ) || '/functions/v1/process-payout-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(current_setting('app.settings.service_role_key', true), current_setting('app.settings.anon_key', true), '')
    ),
    body := '{"scheduled": true}'::jsonb
  ) AS request_id;
  $$
);
