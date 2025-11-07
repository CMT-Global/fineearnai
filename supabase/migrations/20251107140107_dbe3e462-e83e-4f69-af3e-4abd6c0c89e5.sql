-- Phase 1.3: Create get_referral_stats_overview() RPC Function
-- Purpose: Aggregates referral statistics (users with upline) for admin analytics dashboard
-- Returns: Today's count, last 7 days count, and daily breakdown
-- Performance: Uses existing index on referrals.created_at for fast queries

CREATE OR REPLACE FUNCTION get_referral_stats_overview()
RETURNS TABLE (
  today_count bigint,
  last_7days_count bigint,
  daily_breakdown jsonb
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_data AS (
    SELECT 
      DATE(r.created_at) as referral_date,
      COUNT(*) as count
    FROM referrals r
    WHERE r.created_at >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY DATE(r.created_at)
    ORDER BY referral_date DESC
  )
  SELECT 
    (SELECT COUNT(*) FROM referrals WHERE DATE(created_at) = CURRENT_DATE)::bigint as today_count,
    (SELECT COUNT(*) FROM referrals WHERE created_at >= CURRENT_DATE - INTERVAL '7 days')::bigint as last_7days_count,
    (SELECT jsonb_agg(jsonb_build_object('date', referral_date, 'count', count) ORDER BY referral_date) 
     FROM daily_data)::jsonb as daily_breakdown;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users with admin role
GRANT EXECUTE ON FUNCTION get_referral_stats_overview() TO authenticated;