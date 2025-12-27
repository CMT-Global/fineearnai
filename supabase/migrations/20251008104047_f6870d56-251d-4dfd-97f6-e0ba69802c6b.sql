-- Enable pg_cron extension if not already enabled (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    CREATE EXTENSION pg_cron;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Extension might exist with different privileges, ignore
    NULL;
END $$;

-- Enable pg_net extension for HTTP requests (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
  ) THEN
    CREATE EXTENSION pg_net;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Extension might exist with different privileges, ignore
    NULL;
END $$;

-- Schedule cleanup-old-tasks to run daily at 2am UTC (idempotent)
DO $$
BEGIN
  -- Unschedule if it exists to avoid duplicates
  PERFORM cron.unschedule('cleanup-old-ai-tasks');
EXCEPTION
  WHEN OTHERS THEN
    -- Job doesn't exist, continue
    NULL;
END $$;

SELECT cron.schedule(
  'cleanup-old-ai-tasks',
  '0 2 * * *', -- At 2:00 AM UTC every day
  $$
  SELECT
    net.http_post(
        url:='https://mobikymhzchzakwzpqep.supabase.co/functions/v1/cleanup-old-tasks',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vYmlreW1oemNoemFrd3pwcWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NTIzODcsImV4cCI6MjA3NTQyODM4N30.XWSL-ZIzX2DRp5lO7lYnj7L3Cns2z2g3OGdtb8JhDRc"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);