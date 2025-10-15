-- Create materialized view for user daily statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS user_daily_stats AS
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
FROM profiles p
JOIN membership_plans mp ON p.membership_plan = mp.name
WHERE p.account_status = 'active';

-- Create indexes for optimal query performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_daily_stats_user_id ON user_daily_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_daily_stats_membership_plan ON user_daily_stats(membership_plan);
CREATE INDEX IF NOT EXISTS idx_user_daily_stats_account_status ON user_daily_stats(account_status);