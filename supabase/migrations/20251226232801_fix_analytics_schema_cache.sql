-- Fix Analytics Functions Schema Cache Issue
-- This migration ensures all analytics functions are properly exposed to PostgREST
-- and forces a schema cache reload

-- 1. Verify and grant permissions for get_user_growth_stats
DO $$
BEGIN
  -- Check if function exists with correct signature
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_user_growth_stats'
      AND pg_get_function_identity_arguments(p.oid) = 'p_start_date date, p_end_date date'
  ) THEN
    -- Grant execute permission
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_user_growth_stats(date, date) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_user_growth_stats(date, date) TO anon';
    RAISE NOTICE 'Granted permissions on get_user_growth_stats(date, date)';
  ELSE
    RAISE WARNING 'Function get_user_growth_stats(date, date) not found with expected signature';
  END IF;
END $$;

-- 2. Verify and grant permissions for get_deposit_stats
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_deposit_stats'
      AND pg_get_function_identity_arguments(p.oid) = 'p_start_date date, p_end_date date'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_deposit_stats(date, date) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_deposit_stats(date, date) TO anon';
    RAISE NOTICE 'Granted permissions on get_deposit_stats(date, date)';
  END IF;
END $$;

-- 3. Verify and grant permissions for get_referral_stats_overview
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_referral_stats_overview'
      AND pg_get_function_identity_arguments(p.oid) = 'p_start_date date, p_end_date date'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_referral_stats_overview(date, date) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_referral_stats_overview(date, date) TO anon';
    RAISE NOTICE 'Granted permissions on get_referral_stats_overview(date, date)';
  END IF;
END $$;

-- 4. Verify and grant permissions for get_plan_upgrade_stats
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_plan_upgrade_stats'
      AND pg_get_function_identity_arguments(p.oid) = 'p_start_date date, p_end_date date'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_plan_upgrade_stats(date, date) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_plan_upgrade_stats(date, date) TO anon';
    RAISE NOTICE 'Granted permissions on get_plan_upgrade_stats(date, date)';
  END IF;
END $$;

-- 5. Verify and grant permissions for get_withdrawal_stats
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_withdrawal_stats'
      AND pg_get_function_identity_arguments(p.oid) = 'p_start_date date, p_end_date date'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_withdrawal_stats(date, date) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_withdrawal_stats(date, date) TO anon';
    RAISE NOTICE 'Granted permissions on get_withdrawal_stats(date, date)';
  END IF;
END $$;

-- 6. Verify and grant permissions for get_country_stats
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_country_stats'
      AND pg_get_function_identity_arguments(p.oid) = 'p_start_date date, p_end_date date'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_country_stats(date, date) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_country_stats(date, date) TO anon';
    RAISE NOTICE 'Granted permissions on get_country_stats(date, date)';
  END IF;
END $$;

-- 7. Verify and grant permissions for get_top_referrers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_top_referrers'
      AND pg_get_function_identity_arguments(p.oid) = 'p_start_date date, p_end_date date'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_top_referrers(date, date) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_top_referrers(date, date) TO anon';
    RAISE NOTICE 'Granted permissions on get_top_referrers(date, date)';
  END IF;
END $$;

-- 8. Force PostgREST to reload schema cache
-- This is critical - PostgREST caches function signatures and needs to be notified
NOTIFY pgrst, 'reload schema';

-- 9. Also try alternative notification method (some Supabase setups use this)
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;

-- 10. Log function signatures for debugging
DO $$
DECLARE
  func_record RECORD;
BEGIN
  RAISE NOTICE '=== Analytics Functions Signature Check ===';
  FOR func_record IN
    SELECT 
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'get_user_growth_stats',
        'get_deposit_stats',
        'get_referral_stats_overview',
        'get_plan_upgrade_stats',
        'get_withdrawal_stats',
        'get_country_stats',
        'get_top_referrers'
      )
    ORDER BY p.proname
  LOOP
    RAISE NOTICE 'Function: % Arguments: %', func_record.function_name, func_record.arguments;
  END LOOP;
END $$;

