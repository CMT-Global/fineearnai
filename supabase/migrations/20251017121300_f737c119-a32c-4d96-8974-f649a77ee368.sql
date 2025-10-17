-- Phase 1: Delete duplicate CRON job and manually reset test account

-- 1. Delete duplicate CRON job #5 (daily-reset-user-counters)
-- Keep only job #8 (reset-daily-task-limits)
SELECT cron.unschedule('daily-reset-user-counters');

-- 2. Manually reset the test account (qafeocapital@gmail.com) for immediate testing
UPDATE profiles 
SET tasks_completed_today = 0,
    skips_today = 0,
    last_task_date = CURRENT_DATE
WHERE email = 'qafeocapital@gmail.com';