-- Phase 1: Create get_last_7days_activity() aggregator function
-- This function calls all 5 existing stats functions and merges their daily breakdowns
-- into a single table structure optimized for frontend rendering

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
  plan_upgrades_volume NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_user_growth JSONB;
  v_referral_stats JSONB;
  v_deposit_stats JSONB;
  v_withdrawal_stats JSONB;
  v_upgrade_stats JSONB;
BEGIN
  -- Calculate 7-day range (today and previous 6 days)
  v_end_date := CURRENT_DATE;
  v_start_date := CURRENT_DATE - INTERVAL '6 days';
  
  RAISE NOTICE '[7DAYS] Fetching stats for date range: % to %', v_start_date, v_end_date;
  
  -- Call all 5 existing functions and extract their daily_breakdown JSONB
  -- These functions are already optimized with indexes
  SELECT daily_breakdown INTO v_user_growth
  FROM public.get_user_growth_stats(v_start_date, v_end_date);
  
  SELECT daily_breakdown INTO v_referral_stats
  FROM public.get_referral_stats_overview(v_start_date, v_end_date);
  
  SELECT daily_breakdown INTO v_deposit_stats
  FROM public.get_deposit_stats(v_start_date, v_end_date);
  
  SELECT daily_breakdown INTO v_withdrawal_stats
  FROM public.get_withdrawal_stats(v_start_date, v_end_date);
  
  SELECT daily_breakdown INTO v_upgrade_stats
  FROM public.get_plan_upgrade_stats(v_start_date, v_end_date);
  
  RAISE NOTICE '[7DAYS] All stats functions called successfully';
  
  -- Generate all 7 days and merge data from each source
  -- This ensures all dates appear even if they have 0 activity
  RETURN QUERY
  WITH date_series AS (
    -- Generate complete date range
    SELECT generate_series(
      v_start_date,
      v_end_date,
      '1 day'::interval
    )::DATE AS activity_date
  ),
  user_growth_data AS (
    -- Extract registration counts from user growth stats
    SELECT 
      (elem->>'date')::DATE AS activity_date,
      COALESCE((elem->>'new_users')::INTEGER, 0) AS new_registrations
    FROM jsonb_array_elements(COALESCE(v_user_growth, '[]'::jsonb)) elem
  ),
  referral_data AS (
    -- Extract referral counts from referral stats
    SELECT 
      (elem->>'date')::DATE AS activity_date,
      COALESCE((elem->>'new_referrals')::INTEGER, 0) AS referred_users
    FROM jsonb_array_elements(COALESCE(v_referral_stats, '[]'::jsonb)) elem
  ),
  deposit_data AS (
    -- Extract deposit counts and volumes
    SELECT 
      (elem->>'date')::DATE AS activity_date,
      COALESCE((elem->>'count')::INTEGER, 0) AS deposits_count,
      COALESCE((elem->>'volume')::NUMERIC, 0) AS deposits_volume
    FROM jsonb_array_elements(COALESCE(v_deposit_stats, '[]'::jsonb)) elem
  ),
  withdrawal_data AS (
    -- Extract withdrawal counts and volumes
    SELECT 
      (elem->>'date')::DATE AS activity_date,
      COALESCE((elem->>'count')::INTEGER, 0) AS withdrawals_count,
      COALESCE((elem->>'volume')::NUMERIC, 0) AS withdrawals_volume
    FROM jsonb_array_elements(COALESCE(v_withdrawal_stats, '[]'::jsonb)) elem
  ),
  upgrade_data AS (
    -- Extract plan upgrade counts and revenue
    SELECT 
      (elem->>'date')::DATE AS activity_date,
      COALESCE((elem->>'upgrade_count')::INTEGER, 0) AS plan_upgrades_count,
      COALESCE((elem->>'total_revenue')::NUMERIC, 0) AS plan_upgrades_volume
    FROM jsonb_array_elements(COALESCE(v_upgrade_stats, '[]'::jsonb)) elem
  )
  -- Join all data sources on date with LEFT JOIN to preserve all dates
  SELECT 
    ds.activity_date,
    COALESCE(ug.new_registrations, 0)::INTEGER AS new_registrations,
    COALESCE(rd.referred_users, 0)::INTEGER AS referred_users,
    COALESCE(dd.deposits_count, 0)::INTEGER AS deposits_count,
    COALESCE(dd.deposits_volume, 0)::NUMERIC AS deposits_volume,
    COALESCE(wd.withdrawals_count, 0)::INTEGER AS withdrawals_count,
    COALESCE(wd.withdrawals_volume, 0)::NUMERIC AS withdrawals_volume,
    COALESCE(ud.plan_upgrades_count, 0)::INTEGER AS plan_upgrades_count,
    COALESCE(ud.plan_upgrades_volume, 0)::NUMERIC AS plan_upgrades_volume
  FROM date_series ds
  LEFT JOIN user_growth_data ug ON ug.activity_date = ds.activity_date
  LEFT JOIN referral_data rd ON rd.activity_date = ds.activity_date
  LEFT JOIN deposit_data dd ON dd.activity_date = ds.activity_date
  LEFT JOIN withdrawal_data wd ON wd.activity_date = ds.activity_date
  LEFT JOIN upgrade_data ud ON ud.activity_date = ds.activity_date
  ORDER BY ds.activity_date DESC; -- Most recent first
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_last_7days_activity() IS 
'Aggregates last 7 days of platform activity by calling existing stats functions and merging their daily breakdowns. Returns a table with daily metrics for registrations, referrals, deposits, withdrawals, and plan upgrades. Optimized for admin dashboard display.';
