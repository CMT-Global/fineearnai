-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule cleanup-old-tasks to run daily at 2am UTC
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