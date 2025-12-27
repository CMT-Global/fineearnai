-- Create materialized view for user daily statistics (idempotent)
DO $$
BEGIN
  -- Drop if exists (could be view or materialized view) to recreate with latest schema
  DROP VIEW IF EXISTS public.user_daily_stats CASCADE;
  DROP MATERIALIZED VIEW IF EXISTS public.user_daily_stats CASCADE;
  
  CREATE MATERIALIZED VIEW public.user_daily_stats AS
    SELECT 
      p.id as user_id,
      p.username,
      p.tasks_completed_today,
      p.skips_today,
      p.membership_plan,
      p.earnings_wallet_balance,
      p.deposit_wallet_balance,
      p.total_earned,
      p.last_task_date,
      p.plan_expires_at,
      p.account_status,
      mp.daily_task_limit,
      mp.earning_per_task,
      mp.task_skip_limit_per_day,
      mp.task_commission_rate,
      mp.deposit_commission_rate,
      mp.min_withdrawal,
      mp.min_daily_withdrawal,
      mp.max_daily_withdrawal,
      (mp.daily_task_limit - p.tasks_completed_today) as remaining_tasks,
      (mp.task_skip_limit_per_day - p.skips_today) as remaining_skips
    FROM public.profiles p
    JOIN public.membership_plans mp ON p.membership_plan = mp.name
    WHERE p.account_status = 'active';
END $$;

-- Create indexes for optimal query performance (idempotent)
-- Only create indexes if the materialized view exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_matviews 
    WHERE schemaname = 'public' 
    AND matviewname = 'user_daily_stats'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_daily_stats_user_id ON public.user_daily_stats(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_daily_stats_membership_plan ON public.user_daily_stats(membership_plan);
    CREATE INDEX IF NOT EXISTS idx_user_daily_stats_account_status ON public.user_daily_stats(account_status);
  END IF;
END $$;