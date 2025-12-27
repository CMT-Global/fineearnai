-- Grant EXECUTE on analytics RPC functions that accept date range parameters
-- Without these grants, PostgREST returns:
-- "Could not find the function ... in the schema cache"
-- even if the function exists (because it is not exposed to the authenticated role).

DO $$
BEGIN
  -- User growth
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_user_growth_stats'
      AND pg_get_function_identity_arguments(p.oid) = 'p_start_date date, p_end_date date'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_user_growth_stats(date, date) TO authenticated';
  END IF;

  -- Deposits
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_deposit_stats'
      AND pg_get_function_identity_arguments(p.oid) = 'p_start_date date, p_end_date date'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_deposit_stats(date, date) TO authenticated';
  END IF;

  -- Referrals
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_referral_stats_overview'
      AND pg_get_function_identity_arguments(p.oid) = 'p_start_date date, p_end_date date'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_referral_stats_overview(date, date) TO authenticated';
  END IF;

  -- Plan upgrades
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_plan_upgrade_stats'
      AND pg_get_function_identity_arguments(p.oid) = 'p_start_date date, p_end_date date'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_plan_upgrade_stats(date, date) TO authenticated';
  END IF;

  -- Withdrawals
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_withdrawal_stats'
      AND pg_get_function_identity_arguments(p.oid) = 'p_start_date date, p_end_date date'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_withdrawal_stats(date, date) TO authenticated';
  END IF;

  -- Country segmentation
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_country_stats'
      AND pg_get_function_identity_arguments(p.oid) = 'p_start_date date, p_end_date date'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_country_stats(date, date) TO authenticated';
  END IF;

  -- Top referrers
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_top_referrers'
      AND pg_get_function_identity_arguments(p.oid) = 'p_start_date date, p_end_date date'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_top_referrers(date, date) TO authenticated';
  END IF;
END
$$;

-- Ask PostgREST to reload schema cache (Supabase listens on channel 'pgrst')
NOTIFY pgrst, 'reload schema';



