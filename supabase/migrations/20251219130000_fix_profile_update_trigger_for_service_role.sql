-- Fix: Allow SECURITY DEFINER functions (service role) to update sensitive profile fields
-- The trigger was blocking updates from complete_task_atomic function

CREATE OR REPLACE FUNCTION public.validate_profile_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_admin BOOLEAN;
  is_service_role BOOLEAN;
  jwt_claims JSONB;
BEGIN
  -- Check if this is a service role call (from edge function or SECURITY DEFINER function)
  -- Service role JWT has 'role' claim set to 'service_role'
  BEGIN
    jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
    is_service_role := (jwt_claims->>'role' = 'service_role');
  EXCEPTION WHEN OTHERS THEN
    -- If we can't get JWT claims, check if auth.uid() is NULL (service role context)
    is_service_role := (auth.uid() IS NULL);
  END;
  
  -- If called from service role context (edge function), allow all updates
  IF is_service_role THEN
    RETURN NEW;
  END IF;
  
  -- Check if user is admin
  SELECT has_role(auth.uid(), 'admin'::app_role) INTO is_admin;
  
  -- If admin, allow all updates
  IF is_admin THEN
    RETURN NEW;
  END IF;
  
  -- For regular users, only allow safe field updates
  -- Block updates to sensitive fields
  IF (OLD.tasks_completed_today IS DISTINCT FROM NEW.tasks_completed_today AND 
      OLD.tasks_completed_today IS NOT NULL) OR
     (OLD.skips_today IS DISTINCT FROM NEW.skips_today AND 
      OLD.skips_today IS NOT NULL) OR
     (OLD.last_task_date IS DISTINCT FROM NEW.last_task_date AND 
      OLD.last_task_date IS NOT NULL) OR
     (OLD.earnings_wallet_balance IS DISTINCT FROM NEW.earnings_wallet_balance AND 
      OLD.earnings_wallet_balance IS NOT NULL) OR
     (OLD.deposit_wallet_balance IS DISTINCT FROM NEW.deposit_wallet_balance AND 
      OLD.deposit_wallet_balance IS NOT NULL) OR
     (OLD.total_earned IS DISTINCT FROM NEW.total_earned AND 
      OLD.total_earned IS NOT NULL) OR
     (OLD.membership_plan IS DISTINCT FROM NEW.membership_plan AND 
      OLD.membership_plan IS NOT NULL) OR
     (OLD.plan_expires_at IS DISTINCT FROM NEW.plan_expires_at AND 
      OLD.plan_expires_at IS NOT NULL) OR
     (OLD.current_plan_start_date IS DISTINCT FROM NEW.current_plan_start_date AND 
      OLD.current_plan_start_date IS NOT NULL) OR
     (OLD.auto_renew IS DISTINCT FROM NEW.auto_renew AND 
      OLD.auto_renew IS NOT NULL) OR
     (OLD.account_status IS DISTINCT FROM NEW.account_status AND 
      OLD.account_status IS NOT NULL) OR
     (OLD.referral_code IS DISTINCT FROM NEW.referral_code AND 
      OLD.referral_code IS NOT NULL) OR
     (OLD.last_activity IS DISTINCT FROM NEW.last_activity AND 
      OLD.last_activity IS NOT NULL) OR
     (OLD.last_login IS DISTINCT FROM NEW.last_login AND 
      OLD.last_login IS NOT NULL) OR
     (OLD.registration_ip IS DISTINCT FROM NEW.registration_ip AND 
      OLD.registration_ip IS NOT NULL) OR
     (OLD.registration_country IS DISTINCT FROM NEW.registration_country AND 
      OLD.registration_country IS NOT NULL) OR
     (OLD.registration_country_name IS DISTINCT FROM NEW.registration_country_name AND 
      OLD.registration_country_name IS NOT NULL) OR
     (OLD.last_login_ip IS DISTINCT FROM NEW.last_login_ip AND 
      OLD.last_login_ip IS NOT NULL) OR
     (OLD.last_login_country IS DISTINCT FROM NEW.last_login_country AND 
      OLD.last_login_country IS NOT NULL) OR
     (OLD.last_login_country_name IS DISTINCT FROM NEW.last_login_country_name AND 
      OLD.last_login_country_name IS NOT NULL) THEN
    RAISE EXCEPTION 'Cannot update sensitive profile fields from client';
  END IF;
  
  -- Allow updates to safe fields only: full_name, phone, country, payeer_payout_addresses, email, username, preferred_currency
  RETURN NEW;
END;
$function$;
