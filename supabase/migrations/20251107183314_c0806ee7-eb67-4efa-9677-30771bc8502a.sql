-- Fix Cartesian product bug in get_top_referrers function
-- Use separate CTEs to calculate deposits and commissions independently

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
  WITH referrer_base AS (
    -- Count referrals created in the specified period
    SELECT 
      p.id AS user_id,
      p.username,
      p.country AS country_code,
      COUNT(DISTINCT r.referred_id) AS referral_count
    FROM profiles p
    INNER JOIN referrals r ON r.referrer_id = p.id
      AND (p_start_date IS NULL OR r.created_at::DATE >= p_start_date)
      AND (p_end_date IS NULL OR r.created_at::DATE <= p_end_date)
    WHERE r.status = 'active'
    GROUP BY p.id, p.username, p.country
  ),
  referrer_commissions AS (
    -- Calculate total commissions earned in the specified period
    SELECT 
      re.referrer_id,
      COALESCE(SUM(re.commission_amount), 0) AS total_commission
    FROM referral_earnings re
    WHERE (p_start_date IS NULL OR re.created_at::DATE >= p_start_date)
      AND (p_end_date IS NULL OR re.created_at::DATE <= p_end_date)
    GROUP BY re.referrer_id
  ),
  referrer_deposits AS (
    -- Calculate total deposits by downlines in the specified period
    -- Only includes payment processor deposits (excludes admin adjustments)
    SELECT 
      r.referrer_id,
      COALESCE(SUM(t.amount), 0) AS total_referral_deposits
    FROM referrals r
    INNER JOIN transactions t ON t.user_id = r.referred_id
      AND t.type = 'deposit'
      AND t.status = 'completed'
      AND t.payment_gateway IS NOT NULL
      AND (p_start_date IS NULL OR t.created_at::DATE >= p_start_date)
      AND (p_end_date IS NULL OR t.created_at::DATE <= p_end_date)
    WHERE r.status = 'active'
    GROUP BY r.referrer_id
  )
  SELECT 
    rb.user_id,
    rb.username,
    rb.country_code,
    rb.country_code AS country_name,
    rb.referral_count,
    COALESCE(rc.total_commission, 0) AS total_commission,
    COALESCE(rd.total_referral_deposits, 0) AS total_referral_deposits,
    ROW_NUMBER() OVER (ORDER BY rb.referral_count DESC, COALESCE(rc.total_commission, 0) DESC) AS rank
  FROM referrer_base rb
  LEFT JOIN referrer_commissions rc ON rc.referrer_id = rb.user_id
  LEFT JOIN referrer_deposits rd ON rd.referrer_id = rb.user_id
  ORDER BY rb.referral_count DESC, COALESCE(rc.total_commission, 0) DESC
  LIMIT 20;
END;
$$;