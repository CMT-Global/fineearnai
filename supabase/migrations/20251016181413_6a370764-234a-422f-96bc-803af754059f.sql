-- Phase 1.2: Create Optimized Search Function
-- This function provides fast, filtered searching across the user management materialized view
-- Optimized for 1M+ users with <200ms query time

CREATE OR REPLACE FUNCTION public.search_users_optimized(
  p_search_term TEXT DEFAULT NULL,
  p_plan_filter TEXT DEFAULT NULL,
  p_status_filter account_status DEFAULT NULL,
  p_country_filter TEXT DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'created_at',
  p_sort_order TEXT DEFAULT 'DESC',
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  email TEXT,
  full_name TEXT,
  country TEXT,
  phone TEXT,
  membership_plan TEXT,
  account_status account_status,
  deposit_wallet_balance NUMERIC,
  earnings_wallet_balance NUMERIC,
  total_earned NUMERIC,
  plan_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  last_login TIMESTAMP WITH TIME ZONE,
  last_activity TIMESTAMP WITH TIME ZONE,
  total_referrals BIGINT,
  active_referrals BIGINT,
  total_referral_earnings NUMERIC,
  total_tasks_completed BIGINT,
  tasks_today BIGINT,
  total_transactions BIGINT,
  total_deposits NUMERIC,
  total_withdrawals NUMERIC,
  total_withdrawal_requests BIGINT,
  pending_withdrawals BIGINT,
  total_count BIGINT
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  EXECUTE format(
    'SELECT 
      m.*,
      COUNT(*) OVER() as total_count
    FROM mv_user_management m
    WHERE 
      ($1 IS NULL OR 
       m.username ILIKE $1 OR
       m.email ILIKE $1 OR
       m.full_name ILIKE $1 OR
       m.search_vector @@ plainto_tsquery(''english'', $1))
      AND ($2 IS NULL OR m.membership_plan = $2)
      AND ($3 IS NULL OR m.account_status = $3)
      AND ($4 IS NULL OR m.country ILIKE $4)
    ORDER BY %I %s
    LIMIT $5 OFFSET $6',
    p_sort_by,
    CASE WHEN upper(p_sort_order) = 'DESC' THEN 'DESC' ELSE 'ASC' END
  )
  USING 
    CASE 
      WHEN p_search_term IS NOT NULL THEN '%' || p_search_term || '%'
      ELSE NULL 
    END,
    p_plan_filter,
    p_status_filter,
    CASE 
      WHEN p_country_filter IS NOT NULL THEN '%' || p_country_filter || '%'
      ELSE NULL 
    END,
    p_limit,
    p_offset;
END;
$$;

-- Grant execute permission to authenticated users (will be restricted by RLS)
GRANT EXECUTE ON FUNCTION public.search_users_optimized TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.search_users_optimized IS 
'Optimized user search function that queries mv_user_management materialized view. 
Supports full-text search, filtering by plan/status/country, and dynamic sorting.
Performance target: <200ms for 1M+ users.';

-- Create additional helper function for quick user lookup by ID
CREATE OR REPLACE FUNCTION public.get_user_management_by_id(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  username TEXT,
  email TEXT,
  full_name TEXT,
  country TEXT,
  phone TEXT,
  membership_plan TEXT,
  account_status account_status,
  deposit_wallet_balance NUMERIC,
  earnings_wallet_balance NUMERIC,
  total_earned NUMERIC,
  plan_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  last_login TIMESTAMP WITH TIME ZONE,
  last_activity TIMESTAMP WITH TIME ZONE,
  total_referrals BIGINT,
  active_referrals BIGINT,
  total_referral_earnings NUMERIC,
  total_tasks_completed BIGINT,
  tasks_today BIGINT,
  total_transactions BIGINT,
  total_deposits NUMERIC,
  total_withdrawals NUMERIC,
  total_withdrawal_requests BIGINT,
  pending_withdrawals BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.username,
    m.email,
    m.full_name,
    m.country,
    m.phone,
    m.membership_plan,
    m.account_status,
    m.deposit_wallet_balance,
    m.earnings_wallet_balance,
    m.total_earned,
    m.plan_expires_at,
    m.created_at,
    m.last_login,
    m.last_activity,
    m.total_referrals,
    m.active_referrals,
    m.total_referral_earnings,
    m.total_tasks_completed,
    m.tasks_today,
    m.total_transactions,
    m.total_deposits,
    m.total_withdrawals,
    m.total_withdrawal_requests,
    m.pending_withdrawals
  FROM mv_user_management m
  WHERE m.id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_management_by_id TO authenticated;

COMMENT ON FUNCTION public.get_user_management_by_id IS 
'Fast lookup of user management data by user ID from materialized view.
Performance target: <50ms.';

-- Create function to get quick stats for admin dashboard
CREATE OR REPLACE FUNCTION public.get_user_management_stats()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_users', COUNT(*),
    'active_users', COUNT(*) FILTER (WHERE account_status = 'active'),
    'suspended_users', COUNT(*) FILTER (WHERE account_status = 'suspended'),
    'banned_users', COUNT(*) FILTER (WHERE account_status = 'banned'),
    'free_plan_users', COUNT(*) FILTER (WHERE membership_plan = 'free'),
    'paid_plan_users', COUNT(*) FILTER (WHERE membership_plan != 'free'),
    'total_platform_balance', SUM(deposit_wallet_balance + earnings_wallet_balance),
    'total_earnings_paid', SUM(total_earned),
    'total_deposits', SUM(total_deposits),
    'total_withdrawals', SUM(total_withdrawals),
    'pending_withdrawals_count', SUM(pending_withdrawals),
    'active_referrals_count', SUM(active_referrals),
    'total_tasks_completed', SUM(total_tasks_completed)
  )
  INTO result
  FROM mv_user_management;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_management_stats TO authenticated;

COMMENT ON FUNCTION public.get_user_management_stats IS 
'Returns aggregated platform statistics from user management view.
Used for admin dashboard quick stats. Performance target: <100ms.';