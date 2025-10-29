-- Phase 3 Final: Disable Commission Queue Cron Jobs
-- This migration removes the scheduled cron jobs that processed the commission queue

-- Unschedule the 30-second commission processing job
SELECT cron.unschedule('process-commission-queue-job')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-commission-queue-job'
);

-- Unschedule the 5-minute commission processing job
SELECT cron.unschedule('process-commission-queue')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-commission-queue'
);

-- Verification: Query to confirm no commission-related cron jobs exist
-- Run this after migration to verify:
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE '%commission%';