-- Fix hardcoded references to plan name 'free' to use account_type = 'free' instead
-- This fixes the issue where database functions fail when the plan is renamed from 'free' to 'Trainee'

-- 1) Update handle_new_user() function to use account_type instead of name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referral_code_value TEXT;
  referrer_user_id UUID;
  username_value TEXT;
  free_plan_config RECORD;
  calculated_expiry TIMESTAMPTZ;
BEGIN
  referral_code_value := NEW.raw_user_meta_data->>'referral_code';
  username_value := COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8));

  IF referral_code_value IS NOT NULL AND referral_code_value != '' THEN
    SELECT id INTO referrer_user_id FROM public.profiles WHERE referral_code = referral_code_value LIMIT 1;
  END IF;

  -- FIX: Use account_type = 'free' instead of name = 'free'
  SELECT free_plan_expiry_days, billing_period_days INTO free_plan_config
  FROM public.membership_plans
  WHERE account_type = 'free' AND is_active = true
  LIMIT 1;

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

  -- Referral logic
  IF referrer_user_id IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_user_id, signup_date, status)
    VALUES (referrer_user_id, NEW.id, NOW(), 'active')
    ON CONFLICT (referrer_id, referred_user_id) DO NOTHING;

    PERFORM insert_notification(
      referrer_user_id,
      'referral',
      'New Referral Signed Up',
      format('User %s signed up using your referral link!', username_value),
      jsonb_build_object(
        'referred_username', username_value,
        'referred_user_id', NEW.id,
        'referral_code', referral_code_value
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 'Creates profile on signup; uses account_type=free to find default plan (fixes hardcoded name=free issue)';

-- 2) Update handle_profile_wizard_completion() to use account_type
CREATE OR REPLACE FUNCTION handle_profile_wizard_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  default_plan_name TEXT;
  free_plan_expiry INTEGER;
  calculated_expiry TIMESTAMPTZ;
BEGIN
  -- When profile_completed is set to true for the first time
  IF OLD.profile_completed = false AND NEW.profile_completed = true THEN

    -- FIX: Get default plan name by account_type instead of hardcoding 'free'
    SELECT name, free_plan_expiry_days INTO default_plan_name, free_plan_expiry
    FROM public.membership_plans
    WHERE account_type = 'free' AND is_active = true
    LIMIT 1;

    -- Calculate expiry if configured
    IF free_plan_expiry IS NOT NULL AND free_plan_expiry > 0 THEN
      calculated_expiry := NOW() + (free_plan_expiry || ' days')::INTERVAL;
    ELSE
      calculated_expiry := NULL;
    END IF;

    -- Set membership plan to default plan name (e.g. 'Trainee') and update expiry
    NEW.membership_plan := default_plan_name;
    NEW.plan_expires_at := calculated_expiry;
    NEW.current_plan_start_date := NOW();
    NEW.profile_completed_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Update recalculate_free_plan_expiries() RPC function (no parameter version)
CREATE OR REPLACE FUNCTION recalculate_free_plan_expiries()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  default_plan RECORD;
  updated_count INTEGER := 0;
BEGIN
  -- FIX: Get default plan by account_type, not by name
  SELECT name, free_plan_expiry_days, billing_period_days
  INTO default_plan
  FROM public.membership_plans
  WHERE account_type = 'free' AND is_active = true
  LIMIT 1;

  IF default_plan.name IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No active default plan (account_type=free) found'
    );
  END IF;

  -- Update users on default plan
  UPDATE public.profiles
  SET plan_expires_at = CASE
    WHEN default_plan.free_plan_expiry_days IS NOT NULL AND default_plan.free_plan_expiry_days > 0
    THEN current_plan_start_date + (default_plan.free_plan_expiry_days || ' days')::INTERVAL
    ELSE NULL
  END
  WHERE LOWER(TRIM(membership_plan)) = LOWER(TRIM(default_plan.name))
    AND current_plan_start_date IS NOT NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', updated_count,
    'plan_name', default_plan.name,
    'free_plan_expiry_days', default_plan.free_plan_expiry_days
  );
END;
$$;

COMMENT ON FUNCTION recalculate_free_plan_expiries() IS 'Recalculates plan expiry for users on default tier (account_type=free); uses account_type to find plan, not hardcoded name';

-- 4) Update recalculate_free_plan_expiries(p_expiry_days) RPC function (with parameter version)
CREATE OR REPLACE FUNCTION public.recalculate_free_plan_expiries(p_expiry_days integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
  default_plan_name TEXT;
BEGIN
  -- FIX: Get the actual default plan name by account_type, not hardcoded 'free'
  SELECT name INTO default_plan_name
  FROM public.membership_plans
  WHERE account_type = 'free' AND is_active = true
  LIMIT 1;

  IF default_plan_name IS NULL THEN
    RAISE EXCEPTION 'No active default plan (account_type=free) found';
  END IF;

  IF p_expiry_days IS NULL OR p_expiry_days <= 0 THEN
    UPDATE public.profiles
    SET plan_expires_at = NULL
    WHERE LOWER(TRIM(membership_plan)) = LOWER(TRIM(default_plan_name));
  ELSE
    UPDATE public.profiles
    SET plan_expires_at = (COALESCE(current_plan_start_date, created_at) + (p_expiry_days || ' days')::interval)
    WHERE LOWER(TRIM(membership_plan)) = LOWER(TRIM(default_plan_name));
  END IF;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

COMMENT ON FUNCTION public.recalculate_free_plan_expiries(integer) IS
  'Recalculates plan_expires_at for all profiles on the default plan (account_type=free) using the given expiry days. Uses account_type to find plan name.';

GRANT EXECUTE ON FUNCTION public.recalculate_free_plan_expiries(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_free_plan_expiries(integer) TO authenticated;
