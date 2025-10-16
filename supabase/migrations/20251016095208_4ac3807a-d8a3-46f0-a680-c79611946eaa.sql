-- Phase 2: Database Optimizations - Materialized Views for Performance

-- Drop existing materialized views if they exist to recreate with proper structure
DROP MATERIALIZED VIEW IF EXISTS public.mv_user_referral_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_platform_stats CASCADE;

-- Create materialized view for user referral statistics
-- This view aggregates expensive JOIN queries that are called frequently
CREATE MATERIALIZED VIEW public.mv_user_referral_stats AS
SELECT 
  r.referrer_id,
  COUNT(DISTINCT r.referred_id) as total_referrals,
  COUNT(DISTINCT CASE 
    WHEN p.last_activity > NOW() - INTERVAL '24 hours' 
    THEN r.referred_id 
  END) as active_referrals,
  COALESCE(SUM(r.total_commission_earned), 0) as total_earnings,
  COALESCE(SUM(CASE 
    WHEN re.earning_type = 'task_commission' 
    THEN re.commission_amount 
    ELSE 0 
  END), 0) as task_commission_earnings,
  COALESCE(SUM(CASE 
    WHEN re.earning_type = 'deposit_commission' 
    THEN re.commission_amount 
    ELSE 0 
  END), 0) as deposit_commission_earnings
FROM public.referrals r
LEFT JOIN public.profiles p ON p.id = r.referred_id
LEFT JOIN public.referral_earnings re ON re.referrer_id = r.referrer_id
GROUP BY r.referrer_id;

-- Create unique index for fast lookups
CREATE UNIQUE INDEX idx_mv_user_referral_stats_referrer 
ON public.mv_user_referral_stats(referrer_id);

-- Create materialized view for platform-wide statistics
CREATE MATERIALIZED VIEW public.mv_platform_stats AS
SELECT 
  COUNT(DISTINCT p.id) as total_users,
  COUNT(DISTINCT CASE 
    WHEN p.last_activity > NOW() - INTERVAL '30 days' 
    THEN p.id 
  END) as active_users_30d,
  COUNT(DISTINCT tc.id) as total_tasks_completed,
  COUNT(DISTINCT r.id) as total_referrals,
  COALESCE(SUM(p.deposit_wallet_balance + p.earnings_wallet_balance), 0) as total_value_locked,
  COUNT(DISTINCT CASE 
    WHEN wr.status = 'pending' 
    THEN wr.id 
  END) as pending_withdrawals,
  COALESCE(SUM(CASE 
    WHEN t.type = 'plan_upgrade' AND t.created_at::date = CURRENT_DATE 
    THEN t.amount 
    ELSE 0 
  END), 0) as today_platform_earnings,
  COUNT(DISTINCT CASE 
    WHEN at.is_active = true 
    THEN at.id 
  END) as active_tasks_count
FROM public.profiles p
LEFT JOIN public.task_completions tc ON tc.user_id = p.id
LEFT JOIN public.referrals r ON r.referrer_id = p.id
LEFT JOIN public.withdrawal_requests wr ON wr.user_id = p.id
LEFT JOIN public.transactions t ON t.user_id = p.id
LEFT JOIN public.ai_tasks at ON at.is_active = true;

-- Create index for platform stats (single row, but good practice)
CREATE UNIQUE INDEX idx_mv_platform_stats_singleton 
ON public.mv_platform_stats((1));

-- Update get_referral_stats function to use materialized view
CREATE OR REPLACE FUNCTION public.get_referral_stats(user_uuid UUID)
RETURNS TABLE(
  total_referrals BIGINT,
  active_referrals BIGINT,
  total_earnings NUMERIC,
  task_commission_earnings NUMERIC,
  deposit_commission_earnings NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mvs.total_referrals,
    mvs.active_referrals,
    mvs.total_earnings,
    mvs.task_commission_earnings,
    mvs.deposit_commission_earnings
  FROM public.mv_user_referral_stats mvs
  WHERE mvs.referrer_id = user_uuid;
  
  -- If no stats found, return zeros
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::BIGINT, 0::BIGINT, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
  END IF;
END;
$$;

-- Update refresh function to handle both materialized views
CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_user_referral_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_platform_stats;
END;
$$;

-- Initial refresh to populate the views
REFRESH MATERIALIZED VIEW public.mv_user_referral_stats;
REFRESH MATERIALIZED VIEW public.mv_platform_stats;

-- Note: CRON job scheduling must be done via Supabase Dashboard
-- Navigate to: Database > Cron Jobs > Create a new cron job
-- Schedule: */5 * * * * (every 5 minutes)
-- SQL: SELECT public.refresh_materialized_views();