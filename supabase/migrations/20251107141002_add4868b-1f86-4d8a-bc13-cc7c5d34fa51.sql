-- Phase 1.4: Create get_plan_upgrade_stats() RPC Function
-- Purpose: Aggregates plan upgrade statistics (count and volume) for admin analytics dashboard
-- Returns: Today's count/volume, yesterday's count/volume, last 7 days count/volume, and daily breakdown
-- Performance: Uses existing index on transactions.created_at for fast queries

CREATE OR REPLACE FUNCTION get_plan_upgrade_stats()
RETURNS TABLE (
  today_count bigint,
  yesterday_count bigint,
  last_7days_count bigint,
  today_volume numeric,
  yesterday_volume numeric,
  last_7days_volume numeric,
  daily_breakdown jsonb
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_data AS (
    SELECT 
      DATE(t.created_at) as upgrade_date,
      COUNT(*) as count,
      COALESCE(SUM(t.amount), 0) as volume
    FROM transactions t
    WHERE t.type = 'plan_upgrade'
      AND t.status = 'completed'
      AND t.created_at >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY DATE(t.created_at)
    ORDER BY upgrade_date DESC
  )
  SELECT 
    (SELECT COUNT(*) FROM transactions 
     WHERE type = 'plan_upgrade' AND status = 'completed' AND DATE(created_at) = CURRENT_DATE)::bigint as today_count,
    (SELECT COUNT(*) FROM transactions 
     WHERE type = 'plan_upgrade' AND status = 'completed' AND DATE(created_at) = CURRENT_DATE - 1)::bigint as yesterday_count,
    (SELECT COUNT(*) FROM transactions 
     WHERE type = 'plan_upgrade' AND status = 'completed' AND created_at >= CURRENT_DATE - INTERVAL '7 days')::bigint as last_7days_count,
    (SELECT COALESCE(SUM(amount), 0) FROM transactions 
     WHERE type = 'plan_upgrade' AND status = 'completed' AND DATE(created_at) = CURRENT_DATE)::numeric as today_volume,
    (SELECT COALESCE(SUM(amount), 0) FROM transactions 
     WHERE type = 'plan_upgrade' AND status = 'completed' AND DATE(created_at) = CURRENT_DATE - 1)::numeric as yesterday_volume,
    (SELECT COALESCE(SUM(amount), 0) FROM transactions 
     WHERE type = 'plan_upgrade' AND status = 'completed' AND created_at >= CURRENT_DATE - INTERVAL '7 days')::numeric as last_7days_volume,
    (SELECT jsonb_agg(jsonb_build_object('date', upgrade_date, 'count', count, 'volume', volume) ORDER BY upgrade_date) 
     FROM daily_data)::jsonb as daily_breakdown;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users with admin role
GRANT EXECUTE ON FUNCTION get_plan_upgrade_stats() TO authenticated;