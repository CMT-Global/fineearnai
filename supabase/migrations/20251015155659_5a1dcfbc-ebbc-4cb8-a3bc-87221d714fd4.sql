
-- =============================================
-- Phase 5: Auto-Renewal & Expiry Management
-- Setup Cron Job for Daily Plan Cleanup
-- =============================================

-- Enable pg_cron extension for scheduled tasks (idempotent)
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

-- Schedule daily cleanup at 1 AM UTC (idempotent)
-- This will check for expired plans, attempt auto-renewals, and downgrade users as needed
DO $$
BEGIN
  -- Unschedule if it exists to avoid duplicates
  PERFORM cron.unschedule('cleanup-expired-plans-daily');
EXCEPTION
  WHEN OTHERS THEN
    -- Job doesn't exist, continue
    NULL;
END $$;

SELECT cron.schedule(
  'cleanup-expired-plans-daily',
  '0 1 * * *', -- Run at 1 AM UTC every day
  $$
  SELECT net.http_post(
    url := 'https://mobikymhzchzakwzpqep.supabase.co/functions/v1/cleanup-expired-plans',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vYmlreW1oemNoemFrd3pwcWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NTIzODcsImV4cCI6MjA3NTQyODM4N30.XWSL-ZIzX2DRp5lO7lYnj7L3Cns2z2g3OGdtb8JhDRc"}'::jsonb,
    body := '{"scheduled": true}'::jsonb
  ) AS request_id;
  $$
);

-- Create a view to monitor cron job status
CREATE OR REPLACE VIEW cron_job_status AS
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
WHERE jobname = 'cleanup-expired-plans-daily';

-- Grant access to view cron job status to admins
GRANT SELECT ON cron_job_status TO postgres, authenticated;
