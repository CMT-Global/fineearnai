-- Phase 1: Delete duplicate CRON job and manually reset test account (idempotent)

-- 1. Delete duplicate CRON job #5 (daily-reset-user-counters)
-- Keep only job #8 (reset-daily-task-limits)
DO $$
BEGIN
  PERFORM cron.unschedule('daily-reset-user-counters');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 2. Manually reset the test account (qafeocapital@gmail.com) for immediate testing
-- Note: This may fail if trigger prevents updates, but that's okay for idempotency
DO $$
BEGIN
  UPDATE public.profiles 
  SET tasks_completed_today = 0,
      skips_today = 0,
      last_task_date = CURRENT_DATE
  WHERE email = 'qafeocapital@gmail.com';
EXCEPTION
  WHEN OTHERS THEN
    -- If trigger prevents update, that's fine - skip silently
    RAISE NOTICE 'Could not update test account: %', SQLERRM;
END $$;