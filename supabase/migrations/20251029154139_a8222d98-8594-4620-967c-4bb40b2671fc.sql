-- Phase 1: Update profiles table columns to support 4-decimal precision
-- This is the foundation for accurate micro-commission processing ($0.0105, etc.)

-- Step 1: Drop materialized views that depend on the columns we're modifying
DROP MATERIALIZED VIEW IF EXISTS user_daily_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_platform_stats CASCADE;

-- Step 2: Alter column types to NUMERIC(10,4) for 4-decimal precision
ALTER TABLE public.profiles 
  ALTER COLUMN earnings_wallet_balance TYPE NUMERIC(10, 4);

ALTER TABLE public.profiles 
  ALTER COLUMN deposit_wallet_balance TYPE NUMERIC(10, 4);

-- Step 3: Recreate user_daily_stats materialized view
CREATE MATERIALIZED VIEW user_daily_stats AS
SELECT 
  p.id as user_id,
  p.username,
  p.tasks_completed_today,
  p.skips_today,
  p.membership_plan,
  p.earnings_wallet_balance,  -- Now NUMERIC(10,4)
  p.deposit_wallet_balance,   -- Now NUMERIC(10,4)
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
FROM profiles p
JOIN membership_plans mp ON p.membership_plan = mp.name
WHERE p.account_status = 'active';

-- Recreate indexes for user_daily_stats
CREATE UNIQUE INDEX idx_user_daily_stats_user_id ON user_daily_stats(user_id);
CREATE INDEX idx_user_daily_stats_membership_plan ON user_daily_stats(membership_plan);
CREATE INDEX idx_user_daily_stats_account_status ON user_daily_stats(account_status);

-- Step 4: Recreate mv_platform_stats materialized view
CREATE MATERIALIZED VIEW public.mv_platform_stats AS
SELECT 
  COUNT(DISTINCT p.id) as total_users,
  COUNT(DISTINCT CASE 
    WHEN p.last_activity > NOW() - INTERVAL '30 days' 
    THEN p.id 
  END) as active_users_30d,
  COUNT(DISTINCT tc.id) as total_tasks_completed,
  COUNT(DISTINCT r.id) as total_referrals,
  COALESCE(SUM(p.deposit_wallet_balance + p.earnings_wallet_balance), 0) as total_value_locked,  -- Now uses NUMERIC(10,4)
  (SELECT COUNT(*) FROM public.withdrawal_requests WHERE status = 'pending') as pending_withdrawals,
  (SELECT COUNT(*) FROM public.ai_tasks WHERE is_active = true) as active_tasks,
  NOW() as captured_at
FROM public.profiles p
LEFT JOIN public.task_completions tc ON TRUE
LEFT JOIN public.referrals r ON TRUE;

-- Recreate unique index for mv_platform_stats
CREATE UNIQUE INDEX idx_mv_platform_stats_singleton ON public.mv_platform_stats((true));

-- Phase 1 Complete: Columns now support 4-decimal precision
-- Existing data preserved (23.65 → 23.6500)
-- All dependent views recreated successfully
-- Ready for Phase 2: Database function updates