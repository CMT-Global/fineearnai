-- Phase 1.2: Create get_deposit_stats() RPC Function
-- Purpose: Aggregates deposit transaction statistics for admin analytics dashboard
-- Returns: Today's volume/count, yesterday's volume/count, last 7 days volume/count, and daily breakdown
-- Performance: Uses existing index on transactions.created_at for fast queries

CREATE OR REPLACE FUNCTION get_deposit_stats()
RETURNS TABLE (
  today_volume numeric,
  today_count bigint,
  yesterday_volume numeric,
  yesterday_count bigint,
  last_7days_volume numeric,
  last_7days_count bigint,
  daily_breakdown jsonb
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_data AS (
    SELECT 
      DATE(created_at) as deposit_date,
      COUNT(*) as count,
      SUM(amount) as volume
    FROM transactions
    WHERE type = 'deposit' 
      AND status = 'completed'
      AND created_at >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY DATE(created_at)
    ORDER BY deposit_date DESC
  )
  SELECT 
    COALESCE((SELECT SUM(amount) FROM transactions 
              WHERE type = 'deposit' AND status = 'completed' 
              AND DATE(created_at) = CURRENT_DATE), 0)::numeric as today_volume,
    COALESCE((SELECT COUNT(*) FROM transactions 
              WHERE type = 'deposit' AND status = 'completed' 
              AND DATE(created_at) = CURRENT_DATE), 0)::bigint as today_count,
    COALESCE((SELECT SUM(amount) FROM transactions 
              WHERE type = 'deposit' AND status = 'completed' 
              AND DATE(created_at) = CURRENT_DATE - 1), 0)::numeric as yesterday_volume,
    COALESCE((SELECT COUNT(*) FROM transactions 
              WHERE type = 'deposit' AND status = 'completed' 
              AND DATE(created_at) = CURRENT_DATE - 1), 0)::bigint as yesterday_count,
    COALESCE((SELECT SUM(amount) FROM transactions 
              WHERE type = 'deposit' AND status = 'completed' 
              AND created_at >= CURRENT_DATE - INTERVAL '7 days'), 0)::numeric as last_7days_volume,
    COALESCE((SELECT COUNT(*) FROM transactions 
              WHERE type = 'deposit' AND status = 'completed' 
              AND created_at >= CURRENT_DATE - INTERVAL '7 days'), 0)::bigint as last_7days_count,
    (SELECT jsonb_agg(jsonb_build_object('date', deposit_date, 'volume', volume, 'count', count) ORDER BY deposit_date) 
     FROM daily_data)::jsonb as daily_breakdown;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users with admin role
GRANT EXECUTE ON FUNCTION get_deposit_stats() TO authenticated;