-- Phase 1.1: Lock Down Profile RLS Policies
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Create function to validate which columns users can update
CREATE OR REPLACE FUNCTION public.validate_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
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
     (OLD.referred_by IS DISTINCT FROM NEW.referred_by AND 
      OLD.referred_by IS NOT NULL) OR
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
$$;

-- Create trigger to validate profile updates
DROP TRIGGER IF EXISTS validate_profile_update_trigger ON public.profiles;
CREATE TRIGGER validate_profile_update_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (auth.uid() IS NOT NULL)
  EXECUTE FUNCTION public.validate_profile_update();

-- Re-create RLS policies with proper restrictions
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));