-- Fix: New users and existing users with NULL/empty membership_plan get "unknown" plan and 0 tasks.
-- 1) Backfill existing users: set membership_plan = 'free' where NULL or empty
-- 2) Update handle_new_user() to explicitly set membership_plan = 'free' for new signups
-- 3) Ensure profiles.membership_plan has default 'free' so any future inserts are safe

-- 1) Backfill: fix all existing users stuck with no plan (admin shows "Unknown", 0 tasks)
UPDATE public.profiles
SET membership_plan = 'free'
WHERE membership_plan IS NULL OR TRIM(membership_plan) = '';

-- 2) Ensure column default for future safety (idempotent)
ALTER TABLE public.profiles
  ALTER COLUMN membership_plan SET DEFAULT 'free';

-- 3) Update handle_new_user to explicitly set membership_plan = 'free'
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
      membership_plan, plan_expires_at, current_plan_start_date, profile_completed
    ) VALUES (
      NEW.id, username_value, NEW.raw_user_meta_data->>'full_name', NEW.email, generate_referral_code(),
      'free', calculated_expiry, NOW(), false
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

COMMENT ON FUNCTION public.handle_new_user() IS 'Creates profile on signup with membership_plan=free so plan lookup and task access work; backfilled by 20260213140000_fix_new_user_membership_plan.';
