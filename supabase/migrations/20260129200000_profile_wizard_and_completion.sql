-- Profile Completion Wizard: add columns, flags, timestamps, and update handle_new_user + get_user_detail_aggregated
-- Users must complete the profile wizard before accessing tasks. All wizard data stored in profiles.

-- 1) Add new columns to profiles (idempotent)
DO $$
BEGIN
  -- profile_completed: gate for tasks/wallet/earning
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'profile_completed') THEN
    ALTER TABLE public.profiles ADD COLUMN profile_completed BOOLEAN NOT NULL DEFAULT false;
    COMMENT ON COLUMN public.profiles.profile_completed IS 'User completed profile setup wizard. Required before tasks/wallet/earning.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'profile_completed_at') THEN
    ALTER TABLE public.profiles ADD COLUMN profile_completed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'payout_configured') THEN
    ALTER TABLE public.profiles ADD COLUMN payout_configured BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone_verified') THEN
    ALTER TABLE public.profiles ADD COLUMN phone_verified BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone_verified_at') THEN
    ALTER TABLE public.profiles ADD COLUMN phone_verified_at TIMESTAMPTZ;
  END IF;

  -- Wizard fields: identity
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'first_name') THEN
    ALTER TABLE public.profiles ADD COLUMN first_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_name') THEN
    ALTER TABLE public.profiles ADD COLUMN last_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'timezone') THEN
    ALTER TABLE public.profiles ADD COLUMN timezone TEXT;
  END IF;

  -- Wizard fields: preferences (preferred_language already exists)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'earning_goal') THEN
    ALTER TABLE public.profiles ADD COLUMN earning_goal TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'motivation') THEN
    ALTER TABLE public.profiles ADD COLUMN motivation TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'how_did_you_hear') THEN
    ALTER TABLE public.profiles ADD COLUMN how_did_you_hear TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone_country_code') THEN
    ALTER TABLE public.profiles ADD COLUMN phone_country_code TEXT;
  END IF;
END $$;

-- 2) Backfill: existing users who have used the app are considered profile-completed
UPDATE public.profiles
SET profile_completed = true, profile_completed_at = COALESCE(last_activity, created_at)
WHERE profile_completed = false
  AND (last_task_date IS NOT NULL OR last_activity IS NOT NULL OR created_at < now() - interval '1 day');

-- 3) Update handle_new_user: set profile_completed = false for new signups (preserve free plan expiry, referral notification, username conflict handling)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first_user BOOLEAN;
  referrer_user_id UUID;
  referral_code_value TEXT;
  signup_bonus_config RECORD;
  free_plan_config RECORD;
  calculated_expiry TIMESTAMP WITH TIME ZONE;
  username_value TEXT;
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  SELECT NOT EXISTS(SELECT 1 FROM auth.users LIMIT 1) INTO is_first_user;
  referral_code_value := NEW.raw_user_meta_data->>'referral_code';
  username_value := COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8));

  IF referral_code_value IS NOT NULL AND referral_code_value != '' THEN
    SELECT id INTO referrer_user_id FROM public.profiles WHERE referral_code = referral_code_value LIMIT 1;
  END IF;

  SELECT free_plan_expiry_days, billing_period_days INTO free_plan_config FROM public.membership_plans WHERE name = 'free' LIMIT 1;
  IF free_plan_config.free_plan_expiry_days IS NOT NULL AND free_plan_config.free_plan_expiry_days > 0 THEN
    calculated_expiry := NOW() + (free_plan_config.free_plan_expiry_days || ' days')::INTERVAL;
  ELSE
    calculated_expiry := NULL;
  END IF;

  BEGIN
    INSERT INTO public.profiles (
      id, username, full_name, email, referral_code,
      plan_expires_at, current_plan_start_date, profile_completed
    ) VALUES (
      NEW.id, username_value, NEW.raw_user_meta_data->>'full_name', NEW.email, generate_referral_code(),
      calculated_expiry, NOW(), false
    );
  EXCEPTION
    WHEN unique_violation THEN
      IF SQLERRM LIKE '%profiles_username_key%' THEN
        RAISE EXCEPTION 'USERNAME_TAKEN: Username "%" is already registered', username_value USING HINT = 'Please choose a different username';
      ELSE
        RAISE;
      END IF;
  END;

  IF referrer_user_id IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_id, referral_code_used, status)
    VALUES (referrer_user_id, NEW.id, referral_code_value, 'active');

    BEGIN
      supabase_url := current_setting('app.settings.supabase_url', true);
      service_role_key := current_setting('app.settings.service_role_key', true);
      IF supabase_url IS NULL THEN supabase_url := 'https://mobikymhzchzakwzpqep.supabase.co'; END IF;
      PERFORM net.http_post(
        url := supabase_url || '/functions/v1/send-referral-notification',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || COALESCE(service_role_key, '')),
        body := jsonb_build_object('referrer_id', referrer_user_id, 'referred_id', NEW.id, 'referred_username', username_value, 'referred_email', NEW.email, 'referral_code', referral_code_value)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️ [REFERRAL] Failed to trigger email notification: %', SQLERRM;
    END;

    SELECT signup_bonus_enabled, signup_bonus_amount INTO signup_bonus_config FROM public.referral_program_config LIMIT 1;
    IF signup_bonus_config.signup_bonus_enabled AND signup_bonus_config.signup_bonus_amount > 0 THEN
      UPDATE public.profiles SET earnings_wallet_balance = earnings_wallet_balance + signup_bonus_config.signup_bonus_amount, total_earned = total_earned + signup_bonus_config.signup_bonus_amount WHERE id = NEW.id;
      INSERT INTO public.transactions (user_id, type, amount, wallet_type, description, status, new_balance, metadata)
      VALUES (NEW.id, 'referral_earning', signup_bonus_config.signup_bonus_amount, 'earnings', 'Signup bonus for joining via referral', 'completed', signup_bonus_config.signup_bonus_amount,
        jsonb_build_object('bonus_type', 'signup', 'referrer_id', referrer_user_id, 'referral_code', referral_code_value));
    END IF;
  END IF;

  IF is_first_user THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$$;

-- 4) Extend get_user_detail_aggregated profile object with wizard fields (preserve existing structure)
-- Add new keys to 'profile' only; stats, financial, upline, referral_details, recent_activity, plan_info, is_admin unchanged.
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
      'phone_verified', COALESCE(p.phone_verified, false),
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
    'plan_info', (SELECT json_build_object('name', mp.name, 'display_name', mp.display_name, 'account_type', mp.account_type, 'price', mp.price, 'daily_task_limit', mp.daily_task_limit, 'earning_per_task', mp.earning_per_task, 'min_withdrawal', mp.min_withdrawal, 'max_daily_withdrawal', mp.max_daily_withdrawal, 'task_commission_rate', mp.task_commission_rate, 'deposit_commission_rate', mp.deposit_commission_rate, 'max_active_referrals', mp.max_active_referrals, 'features', mp.features) FROM membership_plans mp WHERE mp.name = p.membership_plan LIMIT 1),
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
