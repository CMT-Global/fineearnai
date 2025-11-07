-- Drop and recreate get_last_7days_activity function with CTE pattern to fix nested aggregate error
DROP FUNCTION IF EXISTS public.get_last_7days_activity();

CREATE OR REPLACE FUNCTION public.get_last_7days_activity()
RETURNS TABLE (
  activity_date DATE,
  new_registrations INTEGER,
  referred_users INTEGER,
  deposits_count INTEGER,
  deposits_volume NUMERIC,
  withdrawals_count INTEGER,
  withdrawals_volume NUMERIC,
  plan_upgrades_count INTEGER,
  margin NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_user_growth_stats JSONB;
  v_referral_stats JSONB;
  v_deposit_stats JSONB;
  v_withdrawal_stats JSONB;
  v_upgrade_stats JSONB;
BEGIN
  v_end_date := CURRENT_DATE;
  v_start_date := v_end_date - INTERVAL '6 days';
  
  -- 1. User Growth with CTE pattern
  WITH user_daily AS (
    SELECT 
      DATE(created_at) as reg_date,
      COUNT(*) as user_count
    FROM profiles
    WHERE DATE(created_at) BETWEEN v_start_date AND v_end_date
    GROUP BY DATE(created_at)
  )
  SELECT jsonb_agg(jsonb_build_object('date', reg_date, 'count', user_count))
  INTO v_user_growth_stats
  FROM user_daily;
  
  -- 2. Referral Stats with CTE pattern
  WITH referral_daily AS (
    SELECT 
      DATE(created_at) as ref_date,
      COUNT(*) as ref_count
    FROM referrals
    WHERE DATE(created_at) BETWEEN v_start_date AND v_end_date
    GROUP BY DATE(created_at)
  )
  SELECT jsonb_agg(jsonb_build_object('date', ref_date, 'count', ref_count))
  INTO v_referral_stats
  FROM referral_daily;
  
  -- 3. Deposit Stats with CTE pattern (CRITICAL FIX - removes nested SUM)
  WITH deposit_daily AS (
    SELECT 
      DATE(created_at) as dep_date,
      COUNT(*) as dep_count,
      COALESCE(SUM(amount), 0) as dep_volume
    FROM transactions
    WHERE type = 'deposit' 
      AND status = 'completed'
      AND DATE(created_at) BETWEEN v_start_date AND v_end_date
    GROUP BY DATE(created_at)
  )
  SELECT jsonb_agg(jsonb_build_object('date', dep_date, 'count', dep_count, 'volume', dep_volume))
  INTO v_deposit_stats
  FROM deposit_daily;
  
  -- 4. Withdrawal Stats with CTE pattern (CRITICAL FIX - removes nested SUM)
  WITH withdrawal_daily AS (
    SELECT 
      DATE(created_at) as wd_date,
      COUNT(*) as wd_count,
      COALESCE(SUM(amount), 0) as wd_volume
    FROM transactions
    WHERE type = 'withdrawal' 
      AND status = 'completed'
      AND DATE(created_at) BETWEEN v_start_date AND v_end_date
    GROUP BY DATE(created_at)
  )
  SELECT jsonb_agg(jsonb_build_object('date', wd_date, 'count', wd_count, 'volume', wd_volume))
  INTO v_withdrawal_stats
  FROM withdrawal_daily;
  
  -- 5. Upgrade Stats with CTE pattern
  WITH upgrade_daily AS (
    SELECT 
      DATE(created_at) as upg_date,
      COUNT(*) as upg_count
    FROM transactions
    WHERE type = 'plan_upgrade' 
      AND status = 'completed'
      AND DATE(created_at) BETWEEN v_start_date AND v_end_date
    GROUP BY DATE(created_at)
  )
  SELECT jsonb_agg(jsonb_build_object('date', upg_date, 'count', upg_count))
  INTO v_upgrade_stats
  FROM upgrade_daily;
  
  -- Build final result with all 7 days
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(v_start_date, v_end_date, '1 day'::interval)::DATE AS activity_date
  ),
  user_growth_data AS (
    SELECT 
      (elem->>'date')::DATE AS activity_date,
      COALESCE((elem->>'count')::INTEGER, 0) AS new_registrations
    FROM jsonb_array_elements(COALESCE(v_user_growth_stats, '[]'::jsonb)) elem
  ),
  referral_data AS (
    SELECT 
      (elem->>'date')::DATE AS activity_date,
      COALESCE((elem->>'count')::INTEGER, 0) AS referred_users
    FROM jsonb_array_elements(COALESCE(v_referral_stats, '[]'::jsonb)) elem
  ),
  deposit_data AS (
    SELECT 
      (elem->>'date')::DATE AS activity_date,
      COALESCE((elem->>'count')::INTEGER, 0) AS deposits_count,
      COALESCE((elem->>'volume')::NUMERIC, 0) AS deposits_volume
    FROM jsonb_array_elements(COALESCE(v_deposit_stats, '[]'::jsonb)) elem
  ),
  withdrawal_data AS (
    SELECT 
      (elem->>'date')::DATE AS activity_date,
      COALESCE((elem->>'count')::INTEGER, 0) AS withdrawals_count,
      COALESCE((elem->>'volume')::NUMERIC, 0) AS withdrawals_volume
    FROM jsonb_array_elements(COALESCE(v_withdrawal_stats, '[]'::jsonb)) elem
  ),
  upgrade_data AS (
    SELECT 
      (elem->>'date')::DATE AS activity_date,
      COALESCE((elem->>'count')::INTEGER, 0) AS plan_upgrades_count
    FROM jsonb_array_elements(COALESCE(v_upgrade_stats, '[]'::jsonb)) elem
  )
  SELECT 
    ds.activity_date,
    COALESCE(ug.new_registrations, 0)::INTEGER,
    COALESCE(rd.referred_users, 0)::INTEGER,
    COALESCE(dd.deposits_count, 0)::INTEGER,
    COALESCE(dd.deposits_volume, 0)::NUMERIC,
    COALESCE(wd.withdrawals_count, 0)::INTEGER,
    COALESCE(wd.withdrawals_volume, 0)::NUMERIC,
    COALESCE(ud.plan_upgrades_count, 0)::INTEGER,
    (COALESCE(dd.deposits_volume, 0) - COALESCE(wd.withdrawals_volume, 0))::NUMERIC AS margin
  FROM date_series ds
  LEFT JOIN user_growth_data ug ON ug.activity_date = ds.activity_date
  LEFT JOIN referral_data rd ON rd.activity_date = ds.activity_date
  LEFT JOIN deposit_data dd ON dd.activity_date = ds.activity_date
  LEFT JOIN withdrawal_data wd ON wd.activity_date = ds.activity_date
  LEFT JOIN upgrade_data ud ON ud.activity_date = ds.activity_date
  ORDER BY ds.activity_date DESC;
END;
$$;