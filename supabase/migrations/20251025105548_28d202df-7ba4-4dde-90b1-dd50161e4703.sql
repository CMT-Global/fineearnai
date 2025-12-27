-- Enable required extensions for CRON scheduling (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    CREATE EXTENSION pg_cron;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
  ) THEN
    CREATE EXTENSION pg_net;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Schedule cleanup-pending-transactions to run every 6 hours (idempotent)
-- This ensures pending deposits that never received webhooks are cleaned up
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-pending-transactions');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
  'cleanup-pending-transactions',
  '0 */6 * * *', -- Every 6 hours at minute 0 (00:00, 06:00, 12:00, 18:00)
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/cleanup-pending-transactions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'scheduled_run', true,
        'timestamp', now()
      )
    ) as request_id;
  $$
);