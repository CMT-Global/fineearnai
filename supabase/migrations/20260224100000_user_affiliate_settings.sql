-- User Affiliate (Influencer) Settings
-- Per-user override for commission rates and withdrawal days when is_affiliate = true.

CREATE TABLE IF NOT EXISTS public.user_affiliate_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_affiliate BOOLEAN NOT NULL DEFAULT false,
  affiliate_name_country TEXT,
  deposit_commission_pct NUMERIC(5, 2) CHECK (deposit_commission_pct IS NULL OR (deposit_commission_pct >= 0 AND deposit_commission_pct <= 100)),
  task_commission_pct NUMERIC(5, 2) CHECK (task_commission_pct IS NULL OR (task_commission_pct >= 0 AND task_commission_pct <= 100)),
  override_withdrawal_days BOOLEAN NOT NULL DEFAULT false,
  withdrawal_days JSONB,
  affiliate_membership_plan TEXT REFERENCES public.membership_plans(name) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.user_affiliate_settings IS 'Per-user influencer/affiliate overrides: commission rates and withdrawal schedule.';
COMMENT ON COLUMN public.user_affiliate_settings.withdrawal_days IS 'Same shape as payout_schedule: array of {day, enabled, start_time, end_time}. day 0=Sun, 6=Sat.';

CREATE INDEX IF NOT EXISTS idx_user_affiliate_settings_is_affiliate
  ON public.user_affiliate_settings(is_affiliate) WHERE is_affiliate = true;

ALTER TABLE public.user_affiliate_settings ENABLE ROW LEVEL SECURITY;

-- Admins can do everything; users can read own row only
CREATE POLICY "Admins can manage user_affiliate_settings"
  ON public.user_affiliate_settings
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own affiliate settings"
  ON public.user_affiliate_settings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Extend get_user_detail_aggregated to return affiliate_settings
CREATE OR REPLACE FUNCTION public.get_user_detail_aggregated(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'profile', json_build_object(
      'id', p.id,
      'username', p.username,
      'email', p.email,
      'full_name', p.full_name,
      'phone', p.phone,
      'country', p.country,
      'membership_plan', p.membership_plan,
      'account_status', p.account_status,
      'referral_code', p.referral_code,
      'plan_expires_at', p.plan_expires_at,
      'current_plan_start_date', p.current_plan_start_date,
      'auto_renew', p.auto_renew,
      'allow_daily_withdrawals', COALESCE(p.allow_daily_withdrawals, false),
      'registration_country', p.registration_country,
      'registration_country_name', p.registration_country_name,
      'registration_ip', p.registration_ip,
      'last_login_country', p.last_login_country,
      'last_login_country_name', p.last_login_country_name,
      'last_login_ip', p.last_login_ip,
      'created_at', p.created_at,
      'last_login', p.last_login,
      'last_activity', p.last_activity,
      'email_verified', p.email_verified,
      'email_verified_at', p.email_verified_at,
      'profile_completed', COALESCE(p.profile_completed, false),
      'profile_completed_at', p.profile_completed_at,
      'payout_configured', COALESCE(p.payout_configured, false),
      'phone_verified', p.phone_verified,
      'phone_verified_at', p.phone_verified_at,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'timezone', p.timezone,
      'preferred_language', p.preferred_language,
      'earning_goal', p.earning_goal,
      'motivation', p.motivation,
      'how_did_you_hear', p.how_did_you_hear,
      'phone_country_code', p.phone_country_code,
      'usdt_bep20_address', p.usdt_bep20_address
    ),
    'stats', json_build_object(
      'total_tasks', COALESCE((SELECT COUNT(*) FROM task_completions WHERE user_id = p_user_id), 0),
      'correct_tasks', COALESCE((SELECT COUNT(*) FROM task_completions WHERE user_id = p_user_id AND is_correct = true), 0),
      'wrong_tasks', COALESCE((SELECT COUNT(*) FROM task_completions WHERE user_id = p_user_id AND is_correct = false), 0),
      'accuracy', COALESCE((SELECT ROUND((COUNT(*) FILTER (WHERE is_correct = true) * 100.0) / NULLIF(COUNT(*), 0), 2) FROM task_completions WHERE user_id = p_user_id), 0),
      'total_earned', COALESCE(p.total_earned, 0),
      'tasks_completed_today', COALESCE(p.tasks_completed_today, 0),
      'skips_today', COALESCE(p.skips_today, 0),
      'last_task_date', p.last_task_date,
      'total_referrals', COALESCE((SELECT COUNT(*) FROM referrals WHERE referrer_id = p_user_id), 0),
      'active_referrals', COALESCE((SELECT COUNT(*) FROM referrals WHERE referrer_id = p_user_id AND status = 'active'), 0),
      'total_referral_earnings', COALESCE((SELECT SUM(total_commission_earned) FROM referrals WHERE referrer_id = p_user_id), 0)
    ),
    'financial', json_build_object(
      'deposit_wallet_balance', COALESCE(p.deposit_wallet_balance, 0),
      'earnings_wallet_balance', COALESCE(p.earnings_wallet_balance, 0),
      'total_balance', (COALESCE(p.deposit_wallet_balance, 0) + COALESCE(p.earnings_wallet_balance, 0)),
      'total_deposits', COALESCE((SELECT SUM(amount) FROM transactions WHERE user_id = p_user_id AND type = 'deposit' AND status = 'completed'), 0),
      'total_withdrawals', COALESCE((SELECT SUM(amount) FROM transactions WHERE user_id = p_user_id AND type = 'withdrawal' AND status = 'completed'), 0),
      'pending_withdrawals', COALESCE((SELECT COUNT(*) FROM withdrawal_requests WHERE user_id = p_user_id AND status = 'pending'), 0),
      'pending_withdrawal_amount', COALESCE((SELECT SUM(amount) FROM withdrawal_requests WHERE user_id = p_user_id AND status = 'pending'), 0),
      'total_withdrawal_requests', COALESCE((SELECT COUNT(*) FROM withdrawal_requests WHERE user_id = p_user_id), 0),
      'completed_withdrawals', COALESCE((SELECT COUNT(*) FROM withdrawal_requests WHERE user_id = p_user_id AND status = 'completed'), 0),
      'rejected_withdrawals', COALESCE((SELECT COUNT(*) FROM withdrawal_requests WHERE user_id = p_user_id AND status = 'rejected'), 0),
      'total_transactions', COALESCE((SELECT COUNT(*) FROM transactions WHERE user_id = p_user_id), 0),
      'lifetime_net_earnings', (COALESCE(p.total_earned, 0) + COALESCE((SELECT SUM(amount) FROM transactions WHERE user_id = p_user_id AND type = 'deposit' AND status = 'completed'), 0) - COALESCE((SELECT SUM(amount) FROM transactions WHERE user_id = p_user_id AND type = 'withdrawal' AND status = 'completed'), 0))
    ),
    'upline', (SELECT json_build_object('id', up.id, 'username', up.username, 'email', up.email, 'membership_plan', up.membership_plan, 'account_status', up.account_status, 'referral_code', up.referral_code)
      FROM referrals r INNER JOIN profiles up ON up.id = r.referrer_id WHERE r.referred_id = p_user_id LIMIT 1),
    'referral_details', (SELECT json_build_object('referral_id', r.id, 'status', r.status, 'total_commission_earned', r.total_commission_earned, 'created_at', r.created_at, 'last_commission_date', r.last_commission_date, 'referral_code_used', r.referral_code_used)
      FROM referrals r WHERE r.referred_id = p_user_id LIMIT 1),
    'recent_activity', json_build_object(
      'last_task_completion', (SELECT json_build_object('completed_at', tc.completed_at, 'is_correct', tc.is_correct, 'earnings_amount', tc.earnings_amount) FROM task_completions tc WHERE tc.user_id = p_user_id ORDER BY tc.completed_at DESC LIMIT 1),
      'last_transaction', (SELECT json_build_object('id', t.id, 'type', t.type, 'amount', t.amount, 'status', t.status, 'created_at', t.created_at, 'description', t.description) FROM transactions t WHERE t.user_id = p_user_id ORDER BY t.created_at DESC LIMIT 1),
      'last_withdrawal_request', (SELECT json_build_object('id', wr.id, 'amount', wr.amount, 'status', wr.status, 'payment_method', wr.payment_method, 'created_at', wr.created_at, 'processed_at', wr.processed_at) FROM withdrawal_requests wr WHERE wr.user_id = p_user_id ORDER BY wr.created_at DESC LIMIT 1)
    ),
    'plan_info', (SELECT json_build_object('name', mp.name, 'display_name', mp.display_name, 'account_type', mp.account_type, 'price', mp.price, 'daily_task_limit', mp.daily_task_limit, 'earning_per_task', mp.earning_per_task, 'min_withdrawal', mp.min_withdrawal, 'max_daily_withdrawal', mp.max_daily_withdrawal, 'task_commission_rate', mp.task_commission_rate, 'deposit_commission_rate', mp.deposit_commission_rate, 'max_active_referrals', mp.max_active_referrals, 'features', mp.features) FROM membership_plans mp WHERE mp.name = COALESCE(NULLIF(TRIM(p.membership_plan), ''), (SELECT name FROM membership_plans WHERE account_type = 'free' AND is_active = true LIMIT 1)) LIMIT 1),
    'affiliate_settings', (SELECT json_build_object(
      'user_id', uas.user_id,
      'is_affiliate', COALESCE(uas.is_affiliate, false),
      'affiliate_name_country', uas.affiliate_name_country,
      'deposit_commission_pct', uas.deposit_commission_pct,
      'task_commission_pct', uas.task_commission_pct,
      'override_withdrawal_days', COALESCE(uas.override_withdrawal_days, false),
      'withdrawal_days', uas.withdrawal_days,
      'affiliate_membership_plan', uas.affiliate_membership_plan,
      'updated_at', uas.updated_at
    ) FROM user_affiliate_settings uas WHERE uas.user_id = p_user_id),
    'is_admin', (SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = p_user_id AND role = 'admin'))
  )
  INTO result
  FROM profiles p
  WHERE p.id = p_user_id;

  RETURN result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_user_detail_aggregated(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_detail_aggregated(uuid) TO service_role;
