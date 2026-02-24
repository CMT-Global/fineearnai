-- Extend get_influencer_summary to return columns from user_affiliate_settings.
-- No tables or data are dropped. We only replace the function (drop + create) because
-- PostgreSQL does not allow changing RETURNS TABLE with CREATE OR REPLACE.

DROP FUNCTION IF EXISTS public.get_influencer_summary(timestamptz, timestamptz);

CREATE FUNCTION public.get_influencer_summary(
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
)
RETURNS TABLE(
  user_id uuid,
  username text,
  email text,
  affiliate_name_country text,
  deposit_commission_pct numeric,
  task_commission_pct numeric,
  affiliate_membership_plan text,
  total_referred bigint,
  referred_free bigint,
  referred_upgraded bigint,
  total_deposits_by_referred numeric,
  total_deposit_commissions numeric,
  total_task_commissions numeric,
  total_withdrawn numeric,
  earnings_balance numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.username,
    p.email,
    uas.affiliate_name_country,
    uas.deposit_commission_pct,
    uas.task_commission_pct,
    uas.affiliate_membership_plan,
    (SELECT COUNT(*)::bigint FROM referrals r WHERE r.referrer_id = p.id
      AND (p_date_from IS NULL OR r.created_at >= p_date_from)
      AND (p_date_to IS NULL OR r.created_at <= p_date_to)
    ) AS total_referred,
    (SELECT COUNT(*)::bigint FROM referrals r
      INNER JOIN profiles refp ON refp.id = r.referred_id
      LEFT JOIN membership_plans mp ON LOWER(TRIM(mp.name)) = LOWER(TRIM(COALESCE(NULLIF(TRIM(refp.membership_plan), ''), (SELECT name FROM membership_plans WHERE account_type = 'free' AND is_active = true LIMIT 1))))
      WHERE r.referrer_id = p.id
      AND COALESCE(mp.account_type, 'free') = 'free'
      AND (p_date_from IS NULL OR r.created_at >= p_date_from)
      AND (p_date_to IS NULL OR r.created_at <= p_date_to)
    ) AS referred_free,
    (SELECT COUNT(*)::bigint FROM referrals r
      INNER JOIN profiles refp ON refp.id = r.referred_id
      LEFT JOIN membership_plans mp ON LOWER(TRIM(mp.name)) = LOWER(TRIM(COALESCE(NULLIF(TRIM(refp.membership_plan), ''), (SELECT name FROM membership_plans WHERE account_type = 'free' AND is_active = true LIMIT 1))))
      WHERE r.referrer_id = p.id
      AND COALESCE(mp.account_type, 'free') != 'free'
      AND (p_date_from IS NULL OR r.created_at >= p_date_from)
      AND (p_date_to IS NULL OR r.created_at <= p_date_to)
    ) AS referred_upgraded,
    (SELECT COALESCE(SUM(t.amount), 0) FROM transactions t
      INNER JOIN referrals r ON r.referred_id = t.user_id AND r.referrer_id = p.id
      WHERE t.type = 'deposit' AND t.status = 'completed'
      AND (p_date_from IS NULL OR t.created_at >= p_date_from)
      AND (p_date_to IS NULL OR t.created_at <= p_date_to)
    ) AS total_deposits_by_referred,
    COALESCE(
      NULLIF((
        SELECT SUM(re.commission_amount) FROM referral_earnings re
        WHERE re.referrer_id = p.id AND re.earning_type = 'deposit_commission'
        AND (p_date_from IS NULL OR re.created_at >= p_date_from)
        AND (p_date_to IS NULL OR re.created_at <= p_date_to)
      ), 0),
      (SELECT COALESCE(SUM(t.amount), 0) FROM transactions t
        WHERE t.user_id = p.id AND t.type = 'referral_commission'
        AND t.metadata->>'source' = 'deposit'
        AND (p_date_from IS NULL OR t.created_at >= p_date_from)
        AND (p_date_to IS NULL OR t.created_at <= p_date_to)
      )
    ) AS total_deposit_commissions,
    COALESCE(
      NULLIF((
        SELECT SUM(re.commission_amount) FROM referral_earnings re
        WHERE re.referrer_id = p.id AND re.earning_type = 'task_commission'
        AND (p_date_from IS NULL OR re.created_at >= p_date_from)
        AND (p_date_to IS NULL OR re.created_at <= p_date_to)
      ), 0),
      (SELECT COALESCE(SUM(t.amount), 0) FROM transactions t
        WHERE t.user_id = p.id AND t.type = 'referral_commission'
        AND t.metadata->>'source_event' IN ('task_completion', 'task_completion_4opt')
        AND (p_date_from IS NULL OR t.created_at >= p_date_from)
        AND (p_date_to IS NULL OR t.created_at <= p_date_to)
      )
    ) AS total_task_commissions,
    (SELECT COALESCE(SUM(t.amount), 0) FROM transactions t
      WHERE t.user_id = p.id AND t.type = 'withdrawal' AND t.status = 'completed'
      AND (p_date_from IS NULL OR t.created_at >= p_date_from)
      AND (p_date_to IS NULL OR t.created_at <= p_date_to)
    ) AS total_withdrawn,
    COALESCE(p.earnings_wallet_balance, 0)::numeric AS earnings_balance
  FROM profiles p
  INNER JOIN user_affiliate_settings uas ON uas.user_id = p.id
  WHERE uas.is_affiliate = true
  ORDER BY (
    (SELECT COALESCE(SUM(re.commission_amount), 0) FROM referral_earnings re WHERE re.referrer_id = p.id)
  ) DESC NULLS LAST;
END;
$function$;

COMMENT ON FUNCTION public.get_influencer_summary(timestamptz, timestamptz) IS
  'Returns one row per influencer (user_affiliate_settings.is_affiliate=true): settings (name, commission %, plan), referred counts, deposits by referred, commission totals, withdrawn, balance. Optional date filter.';

GRANT EXECUTE ON FUNCTION public.get_influencer_summary(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_influencer_summary(timestamptz, timestamptz) TO service_role;
