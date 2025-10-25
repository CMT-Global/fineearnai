-- Enable required extensions for CRON scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule cleanup-pending-transactions to run every 6 hours
-- This ensures pending deposits that never received webhooks are cleaned up
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