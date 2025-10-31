-- Phase 2 Enhancement: Add better error messaging for username conflicts in handle_new_user trigger

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
BEGIN
  -- Check if this is the first user
  SELECT NOT EXISTS(SELECT 1 FROM auth.users LIMIT 1) INTO is_first_user;
  
  -- Get referral code and username from metadata
  referral_code_value := NEW.raw_user_meta_data->>'referral_code';
  username_value := COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8));
  
  -- Look up referrer by referral code if provided
  IF referral_code_value IS NOT NULL AND referral_code_value != '' THEN
    SELECT id INTO referrer_user_id
    FROM public.profiles
    WHERE referral_code = referral_code_value
    LIMIT 1;
  END IF;
  
  -- Fetch free plan configuration to determine expiry
  SELECT free_plan_expiry_days, billing_period_days
  INTO free_plan_config
  FROM public.membership_plans
  WHERE name = 'free'
  LIMIT 1;
  
  -- Calculate plan expiry based on free_plan_expiry_days
  IF free_plan_config.free_plan_expiry_days IS NOT NULL AND free_plan_config.free_plan_expiry_days > 0 THEN
    calculated_expiry := NOW() + (free_plan_config.free_plan_expiry_days || ' days')::INTERVAL;
    RAISE NOTICE '✅ Free plan expiry set: % days from now = %', free_plan_config.free_plan_expiry_days, calculated_expiry;
  ELSE
    calculated_expiry := NULL; -- Lifetime free access
    RAISE NOTICE '✅ Free plan: Lifetime access (no expiry)';
  END IF;
  
  -- Insert profile with plan_expires_at set (with enhanced error handling)
  BEGIN
    INSERT INTO public.profiles (
      id,
      username,
      full_name,
      email,
      referral_code,
      plan_expires_at,
      current_plan_start_date
    ) VALUES (
      NEW.id,
      username_value,
      NEW.raw_user_meta_data->>'full_name',
      NEW.email,
      generate_referral_code(),
      calculated_expiry,
      NOW()
    );
  EXCEPTION
    WHEN unique_violation THEN
      -- Check if it's a username conflict
      IF SQLERRM LIKE '%profiles_username_key%' THEN
        RAISE EXCEPTION 'USERNAME_TAKEN: Username "%" is already registered', username_value
          USING HINT = 'Please choose a different username';
      ELSE
        -- Re-raise other unique violations
        RAISE;
      END IF;
  END;
  
  -- Create referral record if referrer exists
  IF referrer_user_id IS NOT NULL THEN
    INSERT INTO public.referrals (
      referrer_id,
      referred_id,
      referral_code_used,
      status
    ) VALUES (
      referrer_user_id,
      NEW.id,
      referral_code_value,
      'active'
    );
    
    -- Check if signup bonus is enabled and apply it
    SELECT signup_bonus_enabled, signup_bonus_amount
    INTO signup_bonus_config
    FROM public.referral_program_config
    LIMIT 1;
    
    IF signup_bonus_config.signup_bonus_enabled AND signup_bonus_config.signup_bonus_amount > 0 THEN
      -- Apply signup bonus to the new user's earnings wallet
      UPDATE public.profiles
      SET 
        earnings_wallet_balance = earnings_wallet_balance + signup_bonus_config.signup_bonus_amount,
        total_earned = total_earned + signup_bonus_config.signup_bonus_amount
      WHERE id = NEW.id;
      
      -- Create transaction record for signup bonus
      INSERT INTO public.transactions (
        user_id,
        type,
        amount,
        wallet_type,
        description,
        status,
        new_balance,
        metadata
      ) VALUES (
        NEW.id,
        'referral_earning',
        signup_bonus_config.signup_bonus_amount,
        'earnings',
        'Signup bonus for joining via referral',
        'completed',
        signup_bonus_config.signup_bonus_amount,
        jsonb_build_object(
          'bonus_type', 'signup',
          'referrer_id', referrer_user_id,
          'referral_code', referral_code_value
        )
      );
    END IF;
  END IF;
  
  -- Assign user role
  IF is_first_user THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;