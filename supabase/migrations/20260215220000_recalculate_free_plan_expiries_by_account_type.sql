-- Recalculate plan_expires_at for all users on the free-tier plan (account_type = 'free'), regardless of plan name (free, Trainee, etc.).
CREATE OR REPLACE FUNCTION public.recalculate_free_plan_expiries(p_expiry_days integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  free_plan_name text;
  updated_count integer;
BEGIN
  SELECT name INTO free_plan_name
  FROM public.membership_plans
  WHERE account_type = 'free'
  LIMIT 1;

  IF free_plan_name IS NULL THEN
    RETURN 0;
  END IF;

  IF p_expiry_days IS NULL OR p_expiry_days <= 0 THEN
    UPDATE public.profiles
    SET plan_expires_at = NULL
    WHERE membership_plan = free_plan_name;
  ELSE
    UPDATE public.profiles
    SET plan_expires_at = (COALESCE(current_plan_start_date, created_at) + (p_expiry_days || ' days')::interval)
    WHERE membership_plan = free_plan_name;
  END IF;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

COMMENT ON FUNCTION public.recalculate_free_plan_expiries(integer) IS
  'Recalculates plan_expires_at for all profiles on the free-tier plan (account_type = free) using the given expiry days. Called when admin updates free plan expiry in membership_plans.';

GRANT EXECUTE ON FUNCTION public.recalculate_free_plan_expiries(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_free_plan_expiries(integer) TO authenticated;
