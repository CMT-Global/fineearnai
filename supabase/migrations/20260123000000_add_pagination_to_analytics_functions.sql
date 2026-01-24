-- Add pagination support to analytics functions
-- This allows fetching data in chunks to improve performance

-- Drop existing functions first to ensure clean migration
DROP FUNCTION IF EXISTS public.get_country_stats(DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.get_top_referrers(DATE, DATE) CASCADE;

-- 1. Update get_country_stats to support pagination
CREATE OR REPLACE FUNCTION public.get_country_stats(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  country_code TEXT,
  country_name TEXT,
  user_count BIGINT,
  total_deposits NUMERIC,
  percentage NUMERIC,
  total_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_users BIGINT;
  v_total_countries BIGINT;
BEGIN
  -- Get total user count for percentage calculation
  SELECT COUNT(DISTINCT p.id)
  INTO v_total_users
  FROM profiles p
  WHERE p.country IS NOT NULL
    AND (p_start_date IS NULL OR p.created_at::DATE >= p_start_date)
    AND (p_end_date IS NULL OR p.created_at::DATE <= p_end_date);

  -- Get total count of countries (for pagination info)
  SELECT COUNT(DISTINCT p.country)
  INTO v_total_countries
  FROM profiles p
  WHERE p.country IS NOT NULL
    AND (p_start_date IS NULL OR p.created_at::DATE >= p_start_date)
    AND (p_end_date IS NULL OR p.created_at::DATE <= p_end_date);

  -- Return country stats with deposit volumes (paginated)
  RETURN QUERY
  WITH country_data AS (
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
  )
  SELECT 
    cd.country_code,
    cd.country_name,
    cd.user_count,
    cd.total_deposits,
    cd.percentage,
    v_total_countries AS total_count
  FROM country_data cd
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 2. Update get_top_referrers to support pagination
CREATE OR REPLACE FUNCTION public.get_top_referrers(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  country_code TEXT,
  country_name TEXT,
  referral_count BIGINT,
  total_commission NUMERIC,
  total_referral_deposits NUMERIC,
  rank BIGINT,
  total_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_referrers BIGINT;
BEGIN
  -- Get total count of referrers (for pagination info)
  SELECT COUNT(DISTINCT p.id)
  INTO v_total_referrers
  FROM profiles p
  INNER JOIN referrals r ON r.referrer_id = p.id
    AND (p_start_date IS NULL OR r.created_at::DATE >= p_start_date)
    AND (p_end_date IS NULL OR r.created_at::DATE <= p_end_date);

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
  ),
  ranked_referrers AS (
    SELECT 
      rs.user_id,
      rs.username,
      rs.country_code,
      rs.country_name,
      rs.referral_count,
      rs.total_commission,
      rs.total_referral_deposits,
      ROW_NUMBER() OVER (ORDER BY rs.total_commission DESC) AS rank
    FROM referrer_stats rs
  )
  SELECT 
    rr.user_id,
    rr.username,
    rr.country_code,
    rr.country_name,
    rr.referral_count,
    rr.total_commission,
    rr.total_referral_deposits,
    rr.rank,
    v_total_referrers AS total_count
  FROM ranked_referrers rr
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_country_stats(DATE, DATE, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_country_stats(DATE, DATE, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.get_top_referrers(DATE, DATE, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_referrers(DATE, DATE, INTEGER, INTEGER) TO anon;

-- Add comments
COMMENT ON FUNCTION public.get_country_stats(DATE, DATE, INTEGER, INTEGER) IS 'Get country segmentation stats with pagination support. Returns total_count for pagination info.';
COMMENT ON FUNCTION public.get_top_referrers(DATE, DATE, INTEGER, INTEGER) IS 'Get top referrers with pagination support. Returns total_count for pagination info.';

-- Force schema cache reload by notifying PostgREST
-- This is done by creating a dummy function that will trigger schema refresh
DO $$
BEGIN
  -- This will force PostgREST to reload its schema cache
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN OTHERS THEN
    -- If pg_notify doesn't work, we'll rely on the next API call to refresh
    NULL;
END $$;
