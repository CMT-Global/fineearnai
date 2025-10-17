-- ============================================
-- PHASE 2: CLEAN UP DEAD CODE
-- Remove all unused functions that depend on mv_user_management
-- Fix CRON job to only refresh existing materialized views
-- ============================================

-- Drop unused functions that depend on mv_user_management
DROP FUNCTION IF EXISTS public.search_users_optimized(text, text, account_status, text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_user_management_stats();
DROP FUNCTION IF EXISTS public.get_user_management_by_id(uuid);
DROP FUNCTION IF EXISTS public.manual_refresh_user_management_view();
DROP FUNCTION IF EXISTS public.get_materialized_view_stats();
DROP FUNCTION IF EXISTS public.check_refresh_system_health();

-- Update refresh function to only refresh views that actually exist
-- mv_user_referral_stats and mv_platform_stats
CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only refresh the two materialized views we actually use
  -- mv_user_referral_stats: Used in Referrals page
  -- mv_platform_stats: Used in Admin Dashboard
  
  -- Refresh user referral stats
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_user_referral_stats;
  
  -- Refresh platform stats
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_platform_stats;
  
  -- Log successful refresh
  RAISE NOTICE 'Successfully refreshed active materialized views (mv_user_referral_stats, mv_platform_stats) at %', now();
  
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail completely
  RAISE WARNING 'Error refreshing materialized views: %', SQLERRM;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.refresh_materialized_views() IS 
'Refreshes only active materialized views used in the application.
- mv_user_referral_stats: Aggregated referral statistics
- mv_platform_stats: Platform-wide metrics
Note: mv_user_management removed - using direct queries instead for real-time data.';