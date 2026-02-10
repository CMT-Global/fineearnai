-- RPC to recalculate plan_expires_at for all free plan users when admin changes free_plan_expiry_days.
-- Called from manage-membership-plan edge function after updating the free plan.
CREATE OR REPLACE FUNCTION public.recalculate_free_plan_expiries(p_expiry_days integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  IF p_expiry_days IS NULL OR p_expiry_days <= 0 THEN
    UPDATE public.profiles
    SET plan_expires_at = NULL
    WHERE LOWER(TRIM(membership_plan)) = 'free';
  ELSE
    UPDATE public.profiles
    SET plan_expires_at = (COALESCE(current_plan_start_date, created_at) + (p_expiry_days || ' days')::interval)
    WHERE LOWER(TRIM(membership_plan)) = 'free';
  END IF;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

COMMENT ON FUNCTION public.recalculate_free_plan_expiries(integer) IS
  'Recalculates plan_expires_at for all profiles on the free plan using the given expiry days. Called when admin updates free plan expiry in membership_plans.';

GRANT EXECUTE ON FUNCTION public.recalculate_free_plan_expiries(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_free_plan_expiries(integer) TO authenticated;
