-- Create get_user_growth_stats function for analytics dashboard
-- This function aggregates user registration statistics for today, yesterday, and last 7 days

CREATE OR REPLACE FUNCTION public.get_user_growth_stats()
RETURNS TABLE(
  today_count INTEGER,
  yesterday_count INTEGER,
  last_7days_count INTEGER,
  daily_breakdown JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today_start TIMESTAMPTZ;
  v_yesterday_start TIMESTAMPTZ;
  v_yesterday_end TIMESTAMPTZ;
  v_seven_days_ago TIMESTAMPTZ;
BEGIN
  -- Calculate UTC date boundaries
  v_today_start := DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC');
  v_yesterday_start := v_today_start - INTERVAL '1 day';
  v_yesterday_end := v_today_start;
  v_seven_days_ago := v_today_start - INTERVAL '7 days';
  
  RETURN QUERY
  SELECT
    -- Today's count
    (
      SELECT COUNT(*)::INTEGER
      FROM public.profiles
      WHERE created_at >= v_today_start
    ) AS today_count,
    
    -- Yesterday's count
    (
      SELECT COUNT(*)::INTEGER
      FROM public.profiles
      WHERE created_at >= v_yesterday_start
        AND created_at < v_yesterday_end
    ) AS yesterday_count,
    
    -- Last 7 days count
    (
      SELECT COUNT(*)::INTEGER
      FROM public.profiles
      WHERE created_at >= v_seven_days_ago
    ) AS last_7days_count,
    
    -- Daily breakdown for last 7 days
    (
      SELECT JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'date', day_date::TEXT,
          'count', day_count
        )
        ORDER BY day_date DESC
      )
      FROM (
        SELECT
          DATE_TRUNC('day', created_at AT TIME ZONE 'UTC')::DATE AS day_date,
          COUNT(*)::INTEGER AS day_count
        FROM public.profiles
        WHERE created_at >= v_seven_days_ago
        GROUP BY DATE_TRUNC('day', created_at AT TIME ZONE 'UTC')::DATE
        ORDER BY day_date DESC
      ) daily_stats
    ) AS daily_breakdown;
END;
$function$;

-- Grant execute permission to authenticated users (admins will access this)
GRANT EXECUTE ON FUNCTION public.get_user_growth_stats() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_user_growth_stats() IS 'Aggregates user registration statistics for analytics dashboard. Returns today count, yesterday count, last 7 days count, and daily breakdown.';
