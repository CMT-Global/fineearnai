-- Function to get country segmentation stats with deposit volumes
CREATE OR REPLACE FUNCTION get_country_stats(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  country_code TEXT,
  country_name TEXT,
  user_count BIGINT,
  total_deposits NUMERIC,
  percentage NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_users BIGINT;
BEGIN
  -- Get total user count for percentage calculation
  SELECT COUNT(DISTINCT p.id)
  INTO v_total_users
  FROM profiles p
  WHERE p.country IS NOT NULL
    AND (p_start_date IS NULL OR p.created_at::DATE >= p_start_date)
    AND (p_end_date IS NULL OR p.created_at::DATE <= p_end_date);

  -- Return country stats with deposit volumes
  RETURN QUERY
  SELECT 
    p.country AS country_code,
    p.country AS country_name,
    COUNT(DISTINCT p.id) AS user_count,
    COALESCE(SUM(t.amount), 0) AS total_deposits,
    CASE 
      WHEN v_total_users > 0 THEN (COUNT(DISTINCT p.id)::NUMERIC / v_total_users::NUMERIC) * 100
      ELSE 0
    END AS percentage
  FROM profiles p
  LEFT JOIN transactions t ON t.user_id = p.id 
    AND t.type = 'deposit' 
    AND t.status = 'completed'
    AND (p_start_date IS NULL OR t.created_at::DATE >= p_start_date)
    AND (p_end_date IS NULL OR t.created_at::DATE <= p_end_date)
  WHERE p.country IS NOT NULL
    AND (p_start_date IS NULL OR p.created_at::DATE >= p_start_date)
    AND (p_end_date IS NULL OR p.created_at::DATE <= p_end_date)
  GROUP BY p.country
  ORDER BY total_deposits DESC, user_count DESC
  LIMIT 20;
END;
$$;

-- Function to get top 20 referrers with country information
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
    ORDER BY total_commission DESC
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
    ROW_NUMBER() OVER (ORDER BY rs.total_commission DESC) AS rank
  FROM referrer_stats rs;
END;
$$;