-- ============================================
-- Fix get_referral_stats RPC Function
-- Uses robust implementation that always returns exactly one row
-- This fixes 400 errors when the materialized view is missing or empty
-- ============================================

-- Step 1: Drop existing function
DROP FUNCTION IF EXISTS public.get_referral_stats(UUID) CASCADE;

-- Step 2: Recreate function that queries source tables directly
-- This avoids issues with materialized view column name mismatches
-- Always returns exactly one row using LEFT JOIN from a dummy row
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
  -- Query source tables directly - always returns exactly one row
  RETURN QUERY
  SELECT 
    COALESCE(COUNT(DISTINCT r.referred_id), 0)::BIGINT as total_referrals,
    COALESCE(COUNT(DISTINCT CASE 
      WHEN p.last_activity > NOW() - INTERVAL '24 hours' 
      THEN r.referred_id 
    END), 0)::BIGINT as active_referrals,
    COALESCE(SUM(re.commission_amount), 0)::NUMERIC as total_earnings,
    COALESCE(SUM(CASE 
      WHEN re.earning_type = 'task_commission' 
      THEN re.commission_amount 
      ELSE 0 
    END), 0)::NUMERIC as task_commission_earnings,
    COALESCE(SUM(CASE 
      WHEN re.earning_type = 'deposit_commission' 
      THEN re.commission_amount 
      ELSE 0 
    END), 0)::NUMERIC as deposit_commission_earnings
  FROM (SELECT user_uuid as referrer_id) u
  LEFT JOIN public.referrals r ON r.referrer_id = u.referrer_id
  LEFT JOIN public.profiles p ON p.id = r.referred_id
  LEFT JOIN public.referral_earnings re ON re.referrer_id = u.referrer_id;
END;
$$;

-- Step 3: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_referral_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_stats(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_referral_stats(UUID) TO service_role;

-- Step 4: Add comment
COMMENT ON FUNCTION public.get_referral_stats(UUID) IS 
'Returns referral statistics for a user. Always returns exactly one row with zero values if no referrals exist.';



