-- Grant execute permissions on get_referral_stats function to authenticated users
-- This fixes the 404 error when calling the RPC function

GRANT EXECUTE ON FUNCTION public.get_referral_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_stats(UUID) TO anon;

