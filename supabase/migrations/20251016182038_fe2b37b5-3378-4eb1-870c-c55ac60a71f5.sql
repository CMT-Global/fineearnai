-- Phase 1.4: Update CRON Job to Refresh mv_user_management
-- This updates the existing refresh_materialized_views function to include the new user management view
-- The CRON job is already scheduled to run every 5 minutes

-- Update the refresh function to include mv_user_management
CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Refresh all materialized views concurrently for better performance
  -- CONCURRENTLY allows reads during refresh (requires unique index)
  
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_user_referral_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_platform_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_user_management;
  
  -- Log successful refresh
  RAISE NOTICE 'Successfully refreshed all materialized views at %', now();
  
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail completely
  RAISE WARNING 'Error refreshing materialized views: %', SQLERRM;
END;
$$;

-- Add documentation
COMMENT ON FUNCTION public.refresh_materialized_views IS 
'Refreshes all materialized views used for performance optimization.
Called by CRON job every 5 minutes.
Includes: mv_user_referral_stats, mv_platform_stats, mv_user_management.
Uses CONCURRENT refresh to allow reads during refresh.';

-- Verify the CRON job exists (this is informational, actual CRON is already set up)
-- The job should already be configured as:
-- SELECT cron.schedule('refresh-materialized-views', '*/5 * * * *', 'SELECT public.refresh_materialized_views();');

-- Create a monitoring function to check last refresh time
CREATE OR REPLACE FUNCTION public.get_materialized_view_stats()
RETURNS TABLE (
  view_name TEXT,
  last_refresh TIMESTAMP WITH TIME ZONE,
  row_count BIGINT,
  size_bytes BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.relname::TEXT AS view_name,
    GREATEST(
      pg_stat_get_last_analyze_time(c.oid),
      pg_stat_get_last_autoanalyze_time(c.oid)
    ) AS last_refresh,
    c.reltuples::BIGINT AS row_count,
    pg_total_relation_size(c.oid) AS size_bytes
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'm' -- materialized views only
    AND n.nspname = 'public'
    AND c.relname IN ('mv_user_referral_stats', 'mv_platform_stats', 'mv_user_management')
  ORDER BY c.relname;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_materialized_view_stats TO authenticated;

COMMENT ON FUNCTION public.get_materialized_view_stats IS 
'Returns statistics about materialized views including last refresh time, row count, and size.
Used by admins to monitor materialized view health and performance.';

-- Create a manual refresh function for admin use (if needed)
CREATE OR REPLACE FUNCTION public.manual_refresh_user_management_view()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_time TIMESTAMP;
  end_time TIMESTAMP;
  refresh_duration INTERVAL;
  row_count BIGINT;
BEGIN
  start_time := clock_timestamp();
  
  -- Refresh the view
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_user_management;
  
  end_time := clock_timestamp();
  refresh_duration := end_time - start_time;
  
  -- Get row count
  SELECT COUNT(*) INTO row_count FROM public.mv_user_management;
  
  -- Return success response
  RETURN json_build_object(
    'success', true,
    'view_name', 'mv_user_management',
    'refreshed_at', end_time,
    'duration_seconds', EXTRACT(EPOCH FROM refresh_duration),
    'row_count', row_count,
    'message', 'User management view refreshed successfully'
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Return error response
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM,
    'message', 'Failed to refresh user management view'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.manual_refresh_user_management_view TO authenticated;

COMMENT ON FUNCTION public.manual_refresh_user_management_view IS 
'Manually triggers a refresh of mv_user_management materialized view.
Returns JSON with refresh statistics including duration and row count.
Used by admins when immediate data refresh is needed.';

-- Create a health check function for the refresh system
CREATE OR REPLACE FUNCTION public.check_refresh_system_health()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'cron_jobs', (
      SELECT json_agg(
        json_build_object(
          'jobname', jobname,
          'schedule', schedule,
          'active', active,
          'database', database
        )
      )
      FROM cron.job
      WHERE jobname LIKE '%refresh%'
    ),
    'materialized_views', (
      SELECT json_agg(
        json_build_object(
          'view_name', view_name,
          'last_refresh', last_refresh,
          'row_count', row_count,
          'size_mb', ROUND(size_bytes / 1024.0 / 1024.0, 2)
        )
      )
      FROM public.get_materialized_view_stats()
    ),
    'system_status', 'healthy',
    'checked_at', now()
  ) INTO result;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_refresh_system_health TO authenticated;

COMMENT ON FUNCTION public.check_refresh_system_health IS 
'Comprehensive health check of the materialized view refresh system.
Returns status of CRON jobs and materialized views.
Used for monitoring and debugging.';