-- ============================================
-- Return referrer's plan max_active_referrals from get_referral_stats
-- So the frontend can show the "limit reached" message without a separate plan lookup.
-- ============================================

DROP FUNCTION IF EXISTS public.get_referral_stats(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.get_referral_stats(user_uuid UUID)
RETURNS TABLE(
  total_referrals BIGINT,
  active_referrals BIGINT,
  upgraded_referrals BIGINT,
  max_active_referrals INTEGER,
  total_earnings NUMERIC,
  task_commission_earnings NUMERIC,
  deposit_commission_earnings NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(COUNT(DISTINCT r.referred_id), 0)::BIGINT AS total_referrals,
    COALESCE(COUNT(DISTINCT CASE
      WHEN p.last_activity > NOW() - INTERVAL '24 hours'
      THEN r.referred_id
    END), 0)::BIGINT AS active_referrals,
    COALESCE((
      SELECT COUNT(*)::BIGINT
      FROM public.referrals r2
      INNER JOIN public.profiles p2 ON p2.id = r2.referred_id
      INNER JOIN public.membership_plans mp ON mp.name = p2.membership_plan AND mp.is_active = true
      WHERE r2.referrer_id = user_uuid AND mp.account_type <> 'free'
    ), 0)::BIGINT AS upgraded_referrals,
    COALESCE((
      SELECT mp2.max_active_referrals
      FROM public.profiles pr
      INNER JOIN public.membership_plans mp2 ON mp2.name = pr.membership_plan AND mp2.is_active = true
      WHERE pr.id = user_uuid
      LIMIT 1
    ), 0)::INTEGER AS max_active_referrals,
    COALESCE(SUM(re.commission_amount), 0)::NUMERIC AS total_earnings,
    COALESCE(SUM(CASE
      WHEN re.earning_type = 'task_commission'
      THEN re.commission_amount
      ELSE 0
    END), 0)::NUMERIC AS task_commission_earnings,
    COALESCE(SUM(CASE
      WHEN re.earning_type = 'deposit_commission'
      THEN re.commission_amount
      ELSE 0
    END), 0)::NUMERIC AS deposit_commission_earnings
  FROM (SELECT user_uuid AS referrer_id) u
  LEFT JOIN public.referrals r ON r.referrer_id = u.referrer_id
  LEFT JOIN public.profiles p ON p.id = r.referred_id
  LEFT JOIN public.referral_earnings re ON re.referrer_id = u.referrer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_referral_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_stats(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_referral_stats(UUID) TO service_role;

COMMENT ON FUNCTION public.get_referral_stats(UUID) IS
'Returns referral statistics for a user. upgraded_referrals = count on paid plan; max_active_referrals = referrer plan limit (for upgraded-only cap).';
