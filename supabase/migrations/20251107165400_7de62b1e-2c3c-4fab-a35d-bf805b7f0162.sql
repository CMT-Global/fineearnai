-- Drop existing function first, then recreate with yesterday_count
DROP FUNCTION IF EXISTS public.get_referral_stats_overview(date, date);

-- Recreate get_referral_stats_overview function with yesterday_count
CREATE OR REPLACE FUNCTION public.get_referral_stats_overview(
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '6 days')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  today_count BIGINT,
  yesterday_count BIGINT,
  last_7days_count BIGINT,
  daily_breakdown JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today_start TIMESTAMP;
  v_today_end TIMESTAMP;
  v_yesterday_start TIMESTAMP;
  v_yesterday_end TIMESTAMP;
BEGIN
  -- Calculate today's boundaries (UTC)
  v_today_start := (CURRENT_DATE AT TIME ZONE 'UTC')::TIMESTAMP;
  v_today_end := ((CURRENT_DATE + INTERVAL '1 day') AT TIME ZONE 'UTC')::TIMESTAMP;
  
  -- Calculate yesterday's boundaries (UTC)
  v_yesterday_start := ((CURRENT_DATE - INTERVAL '1 day') AT TIME ZONE 'UTC')::TIMESTAMP;
  v_yesterday_end := (CURRENT_DATE AT TIME ZONE 'UTC')::TIMESTAMP;

  RETURN QUERY
  SELECT
    -- Today's count
    (SELECT COUNT(*)::BIGINT 
     FROM public.referrals 
     WHERE created_at >= v_today_start AND created_at < v_today_end
    ) AS today_count,
    
    -- Yesterday's count
    (SELECT COUNT(*)::BIGINT 
     FROM public.referrals 
     WHERE created_at >= v_yesterday_start AND created_at < v_yesterday_end
    ) AS yesterday_count,
    
    -- Last 7 days count (within date range)
    (SELECT COUNT(*)::BIGINT 
     FROM public.referrals 
     WHERE DATE(created_at AT TIME ZONE 'UTC') >= p_start_date 
       AND DATE(created_at AT TIME ZONE 'UTC') <= p_end_date
    ) AS last_7days_count,
    
    -- Daily breakdown
    (
      SELECT COALESCE(JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'date', day::TEXT,
          'count', COALESCE(r.count, 0)
        ) ORDER BY day DESC
      ), '[]'::JSONB)
      FROM GENERATE_SERIES(p_start_date, p_end_date, '1 day'::INTERVAL) AS day
      LEFT JOIN (
        SELECT DATE(created_at AT TIME ZONE 'UTC') AS date, COUNT(*) AS count
        FROM public.referrals
        WHERE DATE(created_at AT TIME ZONE 'UTC') >= p_start_date 
          AND DATE(created_at AT TIME ZONE 'UTC') <= p_end_date
        GROUP BY DATE(created_at AT TIME ZONE 'UTC')
      ) r ON day::DATE = r.date
    ) AS daily_breakdown;
END;
$$;