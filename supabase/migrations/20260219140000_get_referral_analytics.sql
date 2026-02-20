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
  WITH referred_users AS (
    SELECT r.referred_id
    FROM public.referrals r
    WHERE r.referrer_id = p_referrer_id
      AND r.status = 'active'
  ),
  period_task_activity AS (
    SELECT
      tc.user_id AS referred_user_id,
      tc.earnings_amount,
      (tc.completed_at AT TIME ZONE 'UTC')::DATE AS day
    FROM public.task_completions tc
    INNER JOIN referred_users ru ON ru.referred_id = tc.user_id
    WHERE tc.completed_at >= p_start_timestamptz
      AND tc.completed_at <= p_end_timestamptz
  ),
  prev_task_activity AS (
    SELECT
      tc.user_id AS referred_user_id,
      tc.earnings_amount
    FROM public.task_completions tc
    INNER JOIN referred_users ru ON ru.referred_id = tc.user_id
    WHERE tc.completed_at >= v_prev_start
      AND tc.completed_at < p_start_timestamptz
  ),
  period_earnings AS (
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
      (SELECT COUNT(DISTINCT referred_user_id)::BIGINT FROM prev_task_activity) AS prev_active,
      COALESCE(SUM(re.commission_amount), 0)::NUMERIC AS prev_commissions,
      (SELECT COALESCE(SUM(earnings_amount), 0)::NUMERIC FROM prev_task_activity) AS prev_team_earnings
    FROM public.referral_earnings re
    WHERE re.referrer_id = p_referrer_id
      AND re.earning_type = 'task_commission'
      AND re.created_at >= v_prev_start
      AND re.created_at < p_start_timestamptz
  ),
  daily_commissions AS (
    SELECT
      day AS date,
      SUM(commission_amount)::NUMERIC AS commission_amount
    FROM period_earnings
    GROUP BY day
  ),
  daily_team_earnings AS (
    SELECT
      day AS date,
      SUM(earnings_amount)::NUMERIC AS team_earnings
    FROM period_task_activity
    GROUP BY day
  ),
  daily_active AS (
    SELECT
      day AS date,
      COUNT(DISTINCT referred_user_id)::BIGINT AS active_count
    FROM period_task_activity
    GROUP BY day
  ),
  daily_dates AS (
    SELECT date FROM daily_commissions
    UNION
    SELECT date FROM daily_team_earnings
    UNION
    SELECT date FROM daily_active
  ),
  daily AS (
    SELECT
      dd.date,
      COALESCE(dc.commission_amount, 0)::NUMERIC AS commission_amount,
      COALESCE(dte.team_earnings, 0)::NUMERIC AS team_earnings,
      COALESCE(da.active_count, 0)::BIGINT AS active_count
    FROM daily_dates dd
    LEFT JOIN daily_commissions dc ON dc.date = dd.date
    LEFT JOIN daily_team_earnings dte ON dte.date = dd.date
    LEFT JOIN daily_active da ON da.date = dd.date
    ORDER BY dd.date
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
      pta.referred_user_id,
      COALESCE(p.username, 'unknown') AS display_name,
      COUNT(*)::BIGINT AS tasks_count,
      SUM(pta.earnings_amount)::NUMERIC AS their_earnings,
      COALESCE((
        SELECT SUM(pe.commission_amount)::NUMERIC
        FROM period_earnings pe
        WHERE pe.referred_user_id = pta.referred_user_id
      ), 0)::NUMERIC AS your_commission
    FROM period_task_activity pta
    LEFT JOIN public.profiles p ON p.id = pta.referred_user_id
    GROUP BY pta.referred_user_id, p.username
    ORDER BY your_commission DESC
    LIMIT 10
  ),
  top_numbered AS (
    SELECT
      referred_user_id,
      display_name,
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
        'masked_display_name', display_name,
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
    (SELECT COUNT(DISTINCT referred_user_id)::BIGINT FROM period_task_activity),
    (SELECT COALESCE(SUM(commission_amount), 0)::NUMERIC FROM period_earnings),
    (SELECT COALESCE(SUM(earnings_amount), 0)::NUMERIC FROM period_task_activity),
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
