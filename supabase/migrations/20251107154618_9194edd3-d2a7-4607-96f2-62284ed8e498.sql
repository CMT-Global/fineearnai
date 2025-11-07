-- Phase 1: Update Analytics Functions to Support Custom Date Ranges
-- This migration updates all 4 analytics functions to accept start_date and end_date parameters

-- 1. Update get_user_growth_stats to accept date range
CREATE OR REPLACE FUNCTION public.get_user_growth_stats(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '6 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  today_count INTEGER,
  yesterday_count INTEGER,
  last_7days_count INTEGER,
  daily_breakdown JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_today_utc DATE;
  v_yesterday_utc DATE;
BEGIN
  -- Get current UTC date for consistency
  v_today_utc := CURRENT_DATE AT TIME ZONE 'UTC';
  v_yesterday_utc := v_today_utc - INTERVAL '1 day';

  RETURN QUERY
  WITH date_series AS (
    -- Generate series of dates from p_start_date to p_end_date
    SELECT generate_series(
      p_start_date,
      p_end_date,
      INTERVAL '1 day'
    )::DATE AS date
  ),
  daily_registrations AS (
    -- Get actual registration counts per day within the date range
    SELECT 
      (created_at AT TIME ZONE 'UTC')::DATE AS registration_date,
      COUNT(*) AS user_count
    FROM profiles
    WHERE (created_at AT TIME ZONE 'UTC')::DATE BETWEEN p_start_date AND p_end_date
    GROUP BY registration_date
  ),
  all_days AS (
    -- Combine date series with actual data, filling gaps with 0
    SELECT 
      ds.date,
      COALESCE(dr.user_count, 0) AS count
    FROM date_series ds
    LEFT JOIN daily_registrations dr ON ds.date = dr.registration_date
    ORDER BY ds.date DESC
  )
  SELECT
    -- Today's count
    (SELECT COUNT(*)::INTEGER 
     FROM profiles 
     WHERE (created_at AT TIME ZONE 'UTC')::DATE = v_today_utc
    ) AS today_count,
    
    -- Yesterday's count
    (SELECT COUNT(*)::INTEGER 
     FROM profiles 
     WHERE (created_at AT TIME ZONE 'UTC')::DATE = v_yesterday_utc
    ) AS yesterday_count,
    
    -- Count for the selected date range
    (SELECT COUNT(*)::INTEGER 
     FROM profiles 
     WHERE (created_at AT TIME ZONE 'UTC')::DATE BETWEEN p_start_date AND p_end_date
    ) AS last_7days_count,
    
    -- Daily breakdown for the selected date range
    (SELECT jsonb_agg(
      jsonb_build_object(
        'date', date,
        'count', count
      )
      ORDER BY date DESC
    )
    FROM all_days
    ) AS daily_breakdown;
END;
$function$;

-- 2. Update get_deposit_stats to accept date range
CREATE OR REPLACE FUNCTION get_deposit_stats(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '6 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  today_volume numeric,
  today_count bigint,
  yesterday_volume numeric,
  yesterday_count bigint,
  last_7days_volume numeric,
  last_7days_count bigint,
  daily_breakdown jsonb
) AS $$
DECLARE
  v_today_utc DATE;
  v_yesterday_utc DATE;
BEGIN
  v_today_utc := CURRENT_DATE AT TIME ZONE 'UTC';
  v_yesterday_utc := v_today_utc - INTERVAL '1 day';

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      p_start_date,
      p_end_date,
      INTERVAL '1 day'
    )::DATE AS date
  ),
  daily_deposits AS (
    SELECT 
      (created_at AT TIME ZONE 'UTC')::DATE AS deposit_date,
      SUM(amount) AS total_volume,
      COUNT(*) AS deposit_count
    FROM transactions
    WHERE type = 'deposit'
      AND status = 'completed'
      AND (created_at AT TIME ZONE 'UTC')::DATE BETWEEN p_start_date AND p_end_date
    GROUP BY deposit_date
  ),
  daily_data AS (
    SELECT 
      ds.date,
      COALESCE(dd.total_volume, 0) AS volume,
      COALESCE(dd.deposit_count, 0) AS count
    FROM date_series ds
    LEFT JOIN daily_deposits dd ON ds.date = dd.deposit_date
    ORDER BY ds.date DESC
  )
  SELECT
    (SELECT COALESCE(SUM(amount), 0)
     FROM transactions
     WHERE type = 'deposit' 
       AND status = 'completed'
       AND (created_at AT TIME ZONE 'UTC')::DATE = v_today_utc
    ) as today_volume,
    
    (SELECT COUNT(*)
     FROM transactions
     WHERE type = 'deposit' 
       AND status = 'completed'
       AND (created_at AT TIME ZONE 'UTC')::DATE = v_today_utc
    ) as today_count,
    
    (SELECT COALESCE(SUM(amount), 0)
     FROM transactions
     WHERE type = 'deposit' 
       AND status = 'completed'
       AND (created_at AT TIME ZONE 'UTC')::DATE = v_yesterday_utc
    ) as yesterday_volume,
    
    (SELECT COUNT(*)
     FROM transactions
     WHERE type = 'deposit' 
       AND status = 'completed'
       AND (created_at AT TIME ZONE 'UTC')::DATE = v_yesterday_utc
    ) as yesterday_count,
    
    (SELECT COALESCE(SUM(amount), 0)
     FROM transactions
     WHERE type = 'deposit' 
       AND status = 'completed'
       AND (created_at AT TIME ZONE 'UTC')::DATE BETWEEN p_start_date AND p_end_date
    ) as last_7days_volume,
    
    (SELECT COUNT(*)
     FROM transactions
     WHERE type = 'deposit' 
       AND status = 'completed'
       AND (created_at AT TIME ZONE 'UTC')::DATE BETWEEN p_start_date AND p_end_date
    ) as last_7days_count,
    
    (SELECT jsonb_agg(
      jsonb_build_object(
        'date', date,
        'volume', volume,
        'count', count
      )
      ORDER BY date DESC
    )
    FROM daily_data)::jsonb as daily_breakdown;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update get_referral_stats_overview to accept date range
CREATE OR REPLACE FUNCTION get_referral_stats_overview(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '6 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  today_count bigint,
  last_7days_count bigint,
  daily_breakdown jsonb
) AS $$
DECLARE
  v_today_utc DATE;
BEGIN
  v_today_utc := CURRENT_DATE AT TIME ZONE 'UTC';

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      p_start_date,
      p_end_date,
      INTERVAL '1 day'
    )::DATE AS date
  ),
  daily_referrals AS (
    SELECT 
      (r.created_at AT TIME ZONE 'UTC')::DATE AS referral_date,
      COUNT(*) AS referral_count
    FROM referrals r
    WHERE (r.created_at AT TIME ZONE 'UTC')::DATE BETWEEN p_start_date AND p_end_date
    GROUP BY referral_date
  ),
  daily_data AS (
    SELECT 
      ds.date,
      COALESCE(dr.referral_count, 0) AS count
    FROM date_series ds
    LEFT JOIN daily_referrals dr ON ds.date = dr.referral_date
    ORDER BY ds.date DESC
  )
  SELECT
    (SELECT COUNT(*)
     FROM referrals
     WHERE (created_at AT TIME ZONE 'UTC')::DATE = v_today_utc
    ) as today_count,
    
    (SELECT COUNT(*)
     FROM referrals
     WHERE (created_at AT TIME ZONE 'UTC')::DATE BETWEEN p_start_date AND p_end_date
    ) as last_7days_count,
    
    (SELECT jsonb_agg(
      jsonb_build_object(
        'date', date,
        'count', count
      )
      ORDER BY date DESC
    )
    FROM daily_data)::jsonb as daily_breakdown;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update get_plan_upgrade_stats to accept date range
CREATE OR REPLACE FUNCTION get_plan_upgrade_stats(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '6 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  today_count bigint,
  yesterday_count bigint,
  last_7days_count bigint,
  today_volume numeric,
  yesterday_volume numeric,
  last_7days_volume numeric,
  daily_breakdown jsonb
) AS $$
DECLARE
  v_today_utc DATE;
  v_yesterday_utc DATE;
BEGIN
  v_today_utc := CURRENT_DATE AT TIME ZONE 'UTC';
  v_yesterday_utc := v_today_utc - INTERVAL '1 day';

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      p_start_date,
      p_end_date,
      INTERVAL '1 day'
    )::DATE AS date
  ),
  daily_upgrades AS (
    SELECT 
      (created_at AT TIME ZONE 'UTC')::DATE AS upgrade_date,
      SUM(amount) AS total_volume,
      COUNT(*) AS upgrade_count
    FROM transactions
    WHERE type = 'plan_upgrade'
      AND status = 'completed'
      AND (created_at AT TIME ZONE 'UTC')::DATE BETWEEN p_start_date AND p_end_date
    GROUP BY upgrade_date
  ),
  daily_data AS (
    SELECT 
      ds.date,
      COALESCE(du.total_volume, 0) AS volume,
      COALESCE(du.upgrade_count, 0) AS count
    FROM date_series ds
    LEFT JOIN daily_upgrades du ON ds.date = du.upgrade_date
    ORDER BY ds.date DESC
  )
  SELECT
    (SELECT COUNT(*)
     FROM transactions
     WHERE type = 'plan_upgrade' 
       AND status = 'completed'
       AND (created_at AT TIME ZONE 'UTC')::DATE = v_today_utc
    ) as today_count,
    
    (SELECT COUNT(*)
     FROM transactions
     WHERE type = 'plan_upgrade' 
       AND status = 'completed'
       AND (created_at AT TIME ZONE 'UTC')::DATE = v_yesterday_utc
    ) as yesterday_count,
    
    (SELECT COUNT(*)
     FROM transactions
     WHERE type = 'plan_upgrade' 
       AND status = 'completed'
       AND (created_at AT TIME ZONE 'UTC')::DATE BETWEEN p_start_date AND p_end_date
    ) as last_7days_count,
    
    (SELECT COALESCE(SUM(amount), 0)
     FROM transactions
     WHERE type = 'plan_upgrade' 
       AND status = 'completed'
       AND (created_at AT TIME ZONE 'UTC')::DATE = v_today_utc
    ) as today_volume,
    
    (SELECT COALESCE(SUM(amount), 0)
     FROM transactions
     WHERE type = 'plan_upgrade' 
       AND status = 'completed'
       AND (created_at AT TIME ZONE 'UTC')::DATE = v_yesterday_utc
    ) as yesterday_volume,
    
    (SELECT COALESCE(SUM(amount), 0)
     FROM transactions
     WHERE type = 'plan_upgrade' 
       AND status = 'completed'
       AND (created_at AT TIME ZONE 'UTC')::DATE BETWEEN p_start_date AND p_end_date
    ) as last_7days_volume,
    
    (SELECT jsonb_agg(
      jsonb_build_object(
        'date', date,
        'volume', volume,
        'count', count
      )
      ORDER BY date DESC
    )
    FROM daily_data)::jsonb as daily_breakdown;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON FUNCTION public.get_user_growth_stats(DATE, DATE) IS 'Aggregates user registration statistics for a custom date range. Defaults to last 7 days if no parameters provided.';
COMMENT ON FUNCTION get_deposit_stats(DATE, DATE) IS 'Aggregates deposit transaction statistics for a custom date range. Defaults to last 7 days if no parameters provided.';
COMMENT ON FUNCTION get_referral_stats_overview(DATE, DATE) IS 'Aggregates referral statistics for a custom date range. Defaults to last 7 days if no parameters provided.';
COMMENT ON FUNCTION get_plan_upgrade_stats(DATE, DATE) IS 'Aggregates plan upgrade statistics for a custom date range. Defaults to last 7 days if no parameters provided.';