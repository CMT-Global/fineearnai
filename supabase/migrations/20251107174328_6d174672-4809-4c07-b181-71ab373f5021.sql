-- Fix Top Referrers ranking to sort by referral_count instead of total_commission
-- This ensures referrers are ranked by the number of referrals brought in, not commission earned

CREATE OR REPLACE FUNCTION get_top_referrers(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  country_code TEXT,
  country_name TEXT,
  referral_count BIGINT,
  total_commission NUMERIC,
  total_referral_deposits NUMERIC,
  rank BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH referrer_stats AS (
    SELECT 
      p.id AS user_id,
      p.username,
      p.country AS country_code,
      p.country AS country_name,
      COUNT(DISTINCT r.referred_id) AS referral_count,
      COALESCE(SUM(re.commission_amount), 0) AS total_commission,
      COALESCE(SUM(
        CASE 
          WHEN t.type = 'deposit' AND t.status = 'completed' 
          THEN t.amount 
          ELSE 0 
        END
      ), 0) AS total_referral_deposits
    FROM profiles p
    INNER JOIN referrals r ON r.referrer_id = p.id
      AND (p_start_date IS NULL OR r.created_at::DATE >= p_start_date)
      AND (p_end_date IS NULL OR r.created_at::DATE <= p_end_date)
    LEFT JOIN referral_earnings re ON re.referrer_id = p.id
      AND (p_start_date IS NULL OR re.created_at::DATE >= p_start_date)
      AND (p_end_date IS NULL OR re.created_at::DATE <= p_end_date)
    LEFT JOIN transactions t ON t.user_id = r.referred_id
      AND t.type = 'deposit'
      AND t.status = 'completed'
      AND (p_start_date IS NULL OR t.created_at::DATE >= p_start_date)
      AND (p_end_date IS NULL OR t.created_at::DATE <= p_end_date)
    GROUP BY p.id, p.username, p.country
    -- CHANGED: Order by referral_count DESC instead of total_commission DESC
    ORDER BY referral_count DESC, total_commission DESC
    LIMIT 20
  )
  SELECT 
    rs.user_id,
    rs.username,
    rs.country_code,
    rs.country_name,
    rs.referral_count,
    rs.total_commission,
    rs.total_referral_deposits,
    -- CHANGED: Rank by referral_count DESC instead of total_commission DESC
    ROW_NUMBER() OVER (ORDER BY rs.referral_count DESC, rs.total_commission DESC) AS rank
  FROM referrer_stats rs;
END;
$$;