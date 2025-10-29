-- Create a diagnostic function to test commission logic
CREATE OR REPLACE FUNCTION public.test_commission_logic(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_referral RECORD;
  v_referrer_plan RECORD;
  v_result JSONB;
BEGIN
  -- Step 1: Check referral
  SELECT * INTO v_referral
  FROM referrals
  WHERE referred_id = p_user_id
  AND status = 'active'
  LIMIT 1;
  
  IF v_referral IS NULL THEN
    RETURN jsonb_build_object(
      'step', 'referral_check',
      'success', false,
      'message', 'No active referral found',
      'user_id', p_user_id
    );
  END IF;
  
  -- Step 2: Check referrer plan
  SELECT mp.* INTO v_referrer_plan
  FROM profiles p
  INNER JOIN membership_plans mp ON mp.name = p.membership_plan
  WHERE p.id = v_referral.referrer_id
  AND mp.is_active = true;
  
  IF v_referrer_plan IS NULL THEN
    RETURN jsonb_build_object(
      'step', 'referrer_plan_check',
      'success', false,
      'message', 'Referrer plan not found or inactive',
      'referrer_id', v_referral.referrer_id,
      'referral_id', v_referral.id
    );
  END IF;
  
  -- Step 3: Return success with details
  RETURN jsonb_build_object(
    'step', 'complete',
    'success', true,
    'referral_found', true,
    'referrer_id', v_referral.referrer_id,
    'referred_id', v_referral.referred_id,
    'referrer_plan', v_referrer_plan.name,
    'task_commission_rate', v_referrer_plan.task_commission_rate,
    'deposit_commission_rate', v_referrer_plan.deposit_commission_rate,
    'commission_would_be', ROUND(0.40 * v_referrer_plan.task_commission_rate, 4)
  );
END;
$function$;

COMMENT ON FUNCTION public.test_commission_logic IS 'Diagnostic function to test commission lookup logic';