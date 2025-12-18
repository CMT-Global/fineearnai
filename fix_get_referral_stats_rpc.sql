-- ============================================
-- Fix get_referral_stats RPC Function
-- This ensures the function is properly exposed via Supabase REST API
-- ============================================

-- Step 1: Verify function exists
SELECT 
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    n.nspname as schema_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'get_referral_stats';

-- Step 2: Ensure function is in public schema and has correct signature
-- Drop and recreate to ensure it's properly exposed
DROP FUNCTION IF EXISTS public.get_referral_stats(UUID);

-- Recreate with explicit schema qualification
CREATE OR REPLACE FUNCTION public.get_referral_stats(user_uuid UUID)
RETURNS TABLE(
  total_referrals BIGINT,
  active_referrals BIGINT,
  total_earnings NUMERIC,
  task_commission_earnings NUMERIC,
  deposit_commission_earnings NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(mvs.total_referrals, 0)::BIGINT,
    COALESCE(mvs.active_referrals, 0)::BIGINT,
    COALESCE(mvs.total_earnings, 0)::NUMERIC,
    COALESCE(mvs.task_commission_earnings, 0)::NUMERIC,
    COALESCE(mvs.deposit_commission_earnings, 0)::NUMERIC
  FROM public.mv_user_referral_stats mvs
  WHERE mvs.referrer_id = user_uuid;
  
  -- If no stats found, return zeros
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::BIGINT, 0::BIGINT, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
  END IF;
END;
$$;

-- Step 3: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_referral_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_stats(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_referral_stats(UUID) TO service_role;

-- Step 4: Verify permissions
SELECT 
    p.proname as function_name,
    r.rolname as role_name,
    has_function_privilege(r.oid, p.oid, 'EXECUTE') as has_execute
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_roles r ON r.rolname IN ('authenticated', 'anon', 'service_role')
WHERE n.nspname = 'public' 
  AND p.proname = 'get_referral_stats'
ORDER BY r.rolname;

-- Step 5: Test the function directly
-- Replace 'YOUR_USER_ID_HERE' with an actual user ID to test
-- SELECT * FROM public.get_referral_stats('YOUR_USER_ID_HERE'::UUID);





