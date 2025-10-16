-- Set up CRON job for auto-refreshing materialized views

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule existing job if it exists (using DO block to handle errors gracefully)
DO $$
BEGIN
  PERFORM cron.unschedule('refresh-materialized-views-5min');
EXCEPTION
  WHEN undefined_object THEN
    -- Job doesn't exist, continue
    NULL;
  WHEN OTHERS THEN
    -- Other errors, continue
    NULL;
END $$;

-- Schedule automatic refresh every 5 minutes
SELECT cron.schedule(
  'refresh-materialized-views-5min',
  '*/5 * * * *',
  $$SELECT public.refresh_materialized_views();$$
);