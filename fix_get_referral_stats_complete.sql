-- ============================================
-- Complete Fix for get_referral_stats RPC Function
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Check if materialized view exists (function depends on it)
SELECT EXISTS (
  SELECT 1 
  FROM pg_matviews 
  WHERE schemaname = 'public' 
    AND matviewname = 'mv_user_referral_stats'
) as view_exists;

-- Step 2: Drop the function completely
DROP FUNCTION IF EXISTS public.get_referral_stats(UUID) CASCADE;

-- Step 3: Recreate the function with proper structure
CREATE FUNCTION public.get_referral_stats(user_uuid UUID)
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
  -- Try to get stats from materialized view
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

-- Step 4: Grant execute permissions to all necessary roles
GRANT EXECUTE ON FUNCTION public.get_referral_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_stats(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_referral_stats(UUID) TO service_role;

-- Step 5: Verify the function exists and is callable
SELECT 
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    n.nspname as schema_name,
    p.prokind as function_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'get_referral_stats';

-- Step 6: Verify permissions
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

-- Step 7: Test the function (uncomment and replace with actual user ID)
-- SELECT * FROM public.get_referral_stats('c9614630-145c-4119-bcba-0298420d1eb4'::UUID);

