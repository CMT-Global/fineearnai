-- Fix security issues with materialized views

-- Enable RLS on materialized views to prevent unauthorized API access
ALTER MATERIALIZED VIEW public.mv_user_referral_stats OWNER TO postgres;
ALTER MATERIALIZED VIEW public.mv_platform_stats OWNER TO postgres;

-- Since materialized views don't support RLS policies directly,
-- we need to revoke public access and only allow access through the function
REVOKE ALL ON public.mv_user_referral_stats FROM PUBLIC;
REVOKE ALL ON public.mv_user_referral_stats FROM anon;
REVOKE ALL ON public.mv_user_referral_stats FROM authenticated;

REVOKE ALL ON public.mv_platform_stats FROM PUBLIC;
REVOKE ALL ON public.mv_platform_stats FROM anon;
REVOKE ALL ON public.mv_platform_stats FROM authenticated;

-- Grant SELECT only to postgres role (used by SECURITY DEFINER functions)
GRANT SELECT ON public.mv_user_referral_stats TO postgres;
GRANT SELECT ON public.mv_platform_stats TO postgres;

-- Ensure the refresh function has proper permissions
GRANT EXECUTE ON FUNCTION public.refresh_materialized_views() TO postgres;