-- Create secure function to get username by referral code
-- This bypasses RLS and only exposes username (no sensitive data)
CREATE OR REPLACE FUNCTION public.get_username_by_referral_code(p_referral_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
BEGIN
  SELECT username INTO v_username
  FROM public.profiles
  WHERE referral_code = p_referral_code
  LIMIT 1;
  
  RETURN v_username;
END;
$$;

-- Grant execute permission to anonymous users (for signup flow)
GRANT EXECUTE ON FUNCTION public.get_username_by_referral_code(TEXT) TO anon;

-- Also grant to authenticated users (in case they want to check codes while logged in)
GRANT EXECUTE ON FUNCTION public.get_username_by_referral_code(TEXT) TO authenticated;