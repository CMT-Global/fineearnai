-- Phase 2.1: Shift CRON Reset to 00:01 UTC
-- Update existing CRON job #8 from 00:00 to 00:01 UTC daily

SELECT cron.alter_job(
  8,
  schedule := '1 0 * * *'  -- 00:01:00 UTC daily (was 0 0 * * *)
);

-- Verify the update
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job 
WHERE jobid = 8;