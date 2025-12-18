-- ============================================
-- Quick Fix: Grant permissions on get_referral_stats
-- Run this directly in Supabase Dashboard SQL Editor
-- ============================================

-- Grant execute permissions on get_referral_stats function to authenticated users
-- This fixes the 404 error when calling the RPC function

GRANT EXECUTE ON FUNCTION public.get_referral_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_stats(UUID) TO anon;

-- Verify the grants were applied
SELECT 
    p.proname as function_name,
    r.rolname as role_name,
    has_function_privilege(r.oid, p.oid, 'EXECUTE') as has_execute
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_roles r ON r.rolname IN ('authenticated', 'anon')
WHERE n.nspname = 'public' 
  AND p.proname = 'get_referral_stats'
ORDER BY r.rolname;





