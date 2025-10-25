-- Update function to normalize referral code input (trim and uppercase)
CREATE OR REPLACE FUNCTION public.get_username_by_referral_code(p_referral_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
BEGIN
  -- Normalize input: trim whitespace and convert to uppercase for comparison
  SELECT username INTO v_username
  FROM public.profiles
  WHERE referral_code = UPPER(TRIM(p_referral_code))
  LIMIT 1;
  
  RETURN v_username;
END;
$$;