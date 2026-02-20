-- Schedule hourly cron for post-upgrade team commissions sequence.
-- URL and auth use app.settings (same pattern as process-trial-reactivation).

DO $$
BEGIN
  PERFORM cron.unschedule('process-post-upgrade-team-commissions-hourly');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'process-post-upgrade-team-commissions-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(
      NULLIF(trim(current_setting('app.settings.supabase_url', true)), ''),
      'https://vrbtmbaqhhxwesqbcywm.supabase.co'
    ) || '/functions/v1/process-post-upgrade-team-commissions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(current_setting('app.settings.service_role_key', true), current_setting('app.settings.anon_key', true), '')
    ),
    body := '{"scheduled": true}'::jsonb
  ) AS request_id;
  $$
);
