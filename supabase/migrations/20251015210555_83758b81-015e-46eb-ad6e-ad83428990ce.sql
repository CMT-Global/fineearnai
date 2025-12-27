-- Enable pg_cron extension if not already enabled (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    CREATE EXTENSION pg_cron WITH SCHEMA cron;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Enable pg_net extension for HTTP requests (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
  ) THEN
    CREATE EXTENSION pg_net WITH SCHEMA net;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Create CRON job to reset daily task limits at midnight UTC every day (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('reset-daily-task-limits');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
  'reset-daily-task-limits',
  '0 0 * * *', -- Every day at midnight UTC (00:00)
  $$
  SELECT
    net.http_post(
        url:='https://mobikymhzchzakwzpqep.supabase.co/functions/v1/reset-daily-counters',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vYmlreW1oemNoemFrd3pwcWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NTIzODcsImV4cCI6MjA3NTQyODM4N30.XWSL-ZIzX2DRp5lO7lYnj7L3Cns2z2g3OGdtb8JhDRc"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);