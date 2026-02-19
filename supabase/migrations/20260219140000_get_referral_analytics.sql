-- ============================================
-- get_referral_analytics: period-based referral analytics for My Team Analytics tab
-- Returns one row: KPIs, daily series, previous-period deltas, top contributors, funnel
-- ============================================

CREATE OR REPLACE FUNCTION public.get_referral_analytics(
  p_referrer_id UUID,
  p_start_timestamptz TIMESTAMPTZ,
  p_end_timestamptz TIMESTAMPTZ
)
RETURNS TABLE (
  team_members_count BIGINT,
  active_members_count BIGINT,
  task_commissions_sum NUMERIC,
  team_earnings_sum NUMERIC,
  daily_series JSONB,
  prev_task_commissions_sum NUMERIC,
  prev_team_earnings_sum NUMERIC,
  prev_active_members_count BIGINT,
  top_contributors JSONB,
  signups_from_link BIGINT,
  upgraded_count BIGINT,
  conversion_rate NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_length INTERVAL;
  v_prev_start TIMESTAMPTZ;
  v_team_members BIGINT;
  v_signups BIGINT;
  v_upgraded BIGINT;
  v_conv NUMERIC;
BEGIN
  -- Restrict to own analytics when auth is present
  IF auth.uid() IS NOT NULL AND auth.uid() != p_referrer_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_period_length := p_end_timestamptz - p_start_timestamptz;
  v_prev_start := p_start_timestamptz - v_period_length;

  -- All-time team size and funnel (signups / upgraded / conversion)
  SELECT COUNT(*)::BIGINT INTO v_team_members
  FROM public.referrals r
  WHERE r.referrer_id = p_referrer_id;

  SELECT COUNT(*)::BIGINT INTO v_upgraded
  FROM public.referrals r
  INNER JOIN public.profiles p ON p.id = r.referred_id
  INNER JOIN public.membership_plans mp ON mp.name = p.membership_plan AND mp.is_active = true
  WHERE r.referrer_id = p_referrer_id AND mp.account_type <> 'free';

  v_signups := v_team_members;
  v_conv := CASE WHEN v_signups > 0 THEN (v_upgraded::NUMERIC / v_signups::NUMERIC) * 100 ELSE 0 END;

  RETURN QUERY
  WITH period_earnings AS (
    SELECT
      re.referred_user_id,
      re.commission_amount,
      re.base_amount,
      (re.created_at AT TIME ZONE 'UTC')::DATE AS day
    FROM public.referral_earnings re
    WHERE re.referrer_id = p_referrer_id
      AND re.earning_type = 'task_commission'
      AND re.created_at >= p_start_timestamptz
      AND re.created_at <= p_end_timestamptz
  ),
  prev_earnings AS (
    SELECT
      COUNT(DISTINCT re.referred_user_id)::BIGINT AS prev_active,
      COALESCE(SUM(re.commission_amount), 0)::NUMERIC AS prev_commissions,
      COALESCE(SUM(re.base_amount), 0)::NUMERIC AS prev_team_earnings
    FROM public.referral_earnings re
    WHERE re.referrer_id = p_referrer_id
      AND re.earning_type = 'task_commission'
      AND re.created_at >= v_prev_start
      AND re.created_at < p_start_timestamptz
  ),
  daily AS (
    SELECT
      day AS date,
      SUM(commission_amount)::NUMERIC AS commission_amount,
      SUM(base_amount)::NUMERIC AS team_earnings,
      COUNT(DISTINCT referred_user_id)::BIGINT AS active_count
    FROM period_earnings
    GROUP BY day
    ORDER BY day
  ),
  daily_agg AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'date', date,
        'commission_amount', commission_amount,
        'team_earnings', team_earnings,
        'active_count', active_count
      )
      ORDER BY date
    ), '[]'::JSONB) AS arr
    FROM daily
  ),
  top AS (
    SELECT
      referred_user_id,
      COUNT(*)::BIGINT AS tasks_count,
      SUM(base_amount)::NUMERIC AS their_earnings,
      SUM(commission_amount)::NUMERIC AS your_commission
    FROM period_earnings
    GROUP BY referred_user_id
    ORDER BY your_commission DESC
    LIMIT 10
  ),
  top_numbered AS (
    SELECT
      referred_user_id,
      tasks_count,
      their_earnings,
      your_commission,
      row_number() OVER (ORDER BY your_commission DESC) AS rn
    FROM top
  ),
  top_with_mask AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'referred_id', referred_user_id,
        'masked_display_name', 'Member #' || rn,
        'tasks_count', tasks_count,
        'their_earnings', their_earnings,
        'your_commission', your_commission
      )
      ORDER BY rn
    ) AS arr
    FROM top_numbered
  )
  SELECT
    v_team_members,
    (SELECT COUNT(DISTINCT referred_user_id)::BIGINT FROM period_earnings),
    (SELECT COALESCE(SUM(commission_amount), 0)::NUMERIC FROM period_earnings),
    (SELECT COALESCE(SUM(base_amount), 0)::NUMERIC FROM period_earnings),
    (SELECT arr FROM daily_agg),
    (SELECT prev_commissions FROM prev_earnings),
    (SELECT prev_team_earnings FROM prev_earnings),
    (SELECT prev_active FROM prev_earnings),
    COALESCE((SELECT arr FROM top_with_mask), '[]'::JSONB),
    v_signups,
    v_upgraded,
    v_conv;
END;
$$;

COMMENT ON FUNCTION public.get_referral_analytics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS
'Returns period-based referral analytics for the My Team Analytics tab. Caller must be the referrer.';

GRANT EXECUTE ON FUNCTION public.get_referral_analytics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_analytics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
