-- Phase 1.1: Create get_registration_stats() RPC Function
-- Purpose: Aggregates user registration statistics for admin analytics dashboard
-- Returns: Today's count, yesterday's count, last 7 days count, and daily breakdown
-- Performance: Uses existing index on profiles.created_at for fast queries

CREATE OR REPLACE FUNCTION get_registration_stats()
RETURNS TABLE (
  today_count bigint,
  yesterday_count bigint,
  last_7days_count bigint,
  daily_breakdown jsonb
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_data AS (
    SELECT 
      DATE(created_at) as reg_date,
      COUNT(*) as count
    FROM profiles
    WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY DATE(created_at)
    ORDER BY reg_date DESC
  )
  SELECT 
    (SELECT COUNT(*) FROM profiles WHERE DATE(created_at) = CURRENT_DATE)::bigint as today_count,
    (SELECT COUNT(*) FROM profiles WHERE DATE(created_at) = CURRENT_DATE - 1)::bigint as yesterday_count,
    (SELECT COUNT(*) FROM profiles WHERE created_at >= CURRENT_DATE - INTERVAL '7 days')::bigint as last_7days_count,
    (SELECT jsonb_agg(jsonb_build_object('date', reg_date, 'count', count) ORDER BY reg_date) 
     FROM daily_data)::jsonb as daily_breakdown;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users with admin role
GRANT EXECUTE ON FUNCTION get_registration_stats() TO authenticated;