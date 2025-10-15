-- Performance Optimization: Add Indexes and Materialized Views

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_date 
  ON public.transactions(user_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_status_created 
  ON public.transactions(status, created_at DESC) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_referral_earnings_referrer_type 
  ON public.referral_earnings(referrer_id, earning_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_completions_user_date 
  ON public.task_completions(user_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_plan_expires 
  ON public.profiles(membership_plan, plan_expires_at) 
  WHERE plan_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_referrer 
  ON public.profiles(referred_by) 
  WHERE referred_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status_created 
  ON public.withdrawal_requests(status, created_at DESC);

-- Materialized view for user referral statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_user_referral_stats AS
SELECT 
  p.id as user_id,
  p.username,
  COUNT(DISTINCT r.referred_id) as total_referrals,
  COUNT(DISTINCT CASE WHEN ref_p.tasks_completed_today > 0 THEN r.referred_id END) as active_referrals,
  COALESCE(SUM(re.commission_amount), 0) as total_commission_earned,
  COALESCE(SUM(CASE WHEN re.earning_type = 'task_commission' THEN re.commission_amount ELSE 0 END), 0) as task_commission_earned,
  COALESCE(SUM(CASE WHEN re.earning_type = 'deposit_commission' THEN re.commission_amount ELSE 0 END), 0) as deposit_commission_earned,
  MAX(re.created_at) as last_commission_date
FROM public.profiles p
LEFT JOIN public.referrals r ON p.id = r.referrer_id
LEFT JOIN public.profiles ref_p ON r.referred_id = ref_p.id
LEFT JOIN public.referral_earnings re ON p.id = re.referrer_id
GROUP BY p.id, p.username;

-- Create unique index for materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_referral_stats_user_id 
  ON public.mv_user_referral_stats(user_id);

-- Materialized view for platform statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_platform_stats AS
SELECT 
  (SELECT COUNT(*) FROM public.profiles) as total_users,
  (SELECT COUNT(*) FROM public.profiles WHERE last_activity > now() - interval '30 days') as active_users,
  (SELECT COUNT(*) FROM public.task_completions) as total_tasks_completed,
  (SELECT COUNT(*) FROM public.referrals) as total_referrals,
  (SELECT COALESCE(SUM(deposit_wallet_balance + earnings_wallet_balance), 0) FROM public.profiles) as total_value_locked,
  (SELECT COUNT(*) FROM public.withdrawal_requests WHERE status = 'pending') as pending_withdrawals,
  (SELECT COUNT(*) FROM public.ai_tasks WHERE is_active = true) as active_tasks,
  now() as last_updated;

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_user_referral_stats;
  REFRESH MATERIALIZED VIEW public.mv_platform_stats;
END;
$$;

-- Grant permissions
GRANT SELECT ON public.mv_user_referral_stats TO authenticated;
GRANT SELECT ON public.mv_platform_stats TO authenticated;

-- Create function to analyze query performance
CREATE OR REPLACE FUNCTION public.analyze_query_performance(query_text text)
RETURNS TABLE(plan_line text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY EXECUTE 'EXPLAIN ANALYZE ' || query_text;
END;
$$;

-- Comment on materialized views
COMMENT ON MATERIALIZED VIEW public.mv_user_referral_stats IS 
  'Cached referral statistics per user. Refresh hourly via cron job.';

COMMENT ON MATERIALIZED VIEW public.mv_platform_stats IS 
  'Cached platform-wide statistics. Refresh every 15 minutes via cron job.';