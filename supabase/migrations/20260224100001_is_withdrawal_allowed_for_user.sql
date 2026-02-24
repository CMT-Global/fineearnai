-- Withdrawal schedule check for a specific user (supports influencer override).
-- If user has affiliate override_withdrawal_days = true and withdrawal_days set, use that schedule;
-- otherwise fall back to global is_withdrawal_allowed().

CREATE OR REPLACE FUNCTION public.is_withdrawal_allowed_for_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_override boolean;
  v_schedule jsonb;
  v_current_day integer;
  v_utc_time text;
  v_day_schedule jsonb;
BEGIN
  -- Check for influencer override
  SELECT uas.override_withdrawal_days, uas.withdrawal_days
  INTO v_override, v_schedule
  FROM user_affiliate_settings uas
  WHERE uas.user_id = p_user_id
    AND uas.is_affiliate = true
    AND uas.override_withdrawal_days = true
    AND uas.withdrawal_days IS NOT NULL
    AND jsonb_typeof(uas.withdrawal_days) = 'array';

  IF v_override AND v_schedule IS NOT NULL AND jsonb_array_length(v_schedule) > 0 THEN
    -- Use user's schedule: same logic as is_withdrawal_allowed but with v_schedule
    v_current_day := EXTRACT(DOW FROM (NOW() AT TIME ZONE 'UTC'))::integer;
    v_utc_time := TO_CHAR((NOW() AT TIME ZONE 'UTC'), 'HH24:MI');

    SELECT elem INTO v_day_schedule
    FROM jsonb_array_elements(v_schedule) elem
    WHERE (elem->>'day')::integer = v_current_day
      AND (elem->>'enabled')::boolean = true
    LIMIT 1;

    IF v_day_schedule IS NULL THEN
      RETURN false;
    END IF;

    IF v_utc_time >= (v_day_schedule->>'start_time') AND
       v_utc_time <= (v_day_schedule->>'end_time') THEN
      RETURN true;
    ELSE
      RETURN false;
    END IF;
  END IF;

  -- No override: use global schedule
  RETURN public.is_withdrawal_allowed();
END;
$function$;

COMMENT ON FUNCTION public.is_withdrawal_allowed_for_user(uuid) IS
  'Returns true if withdrawal is allowed for the user now. Uses influencer withdrawal_days override when set, else global payout_schedule.';

GRANT EXECUTE ON FUNCTION public.is_withdrawal_allowed_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_withdrawal_allowed_for_user(uuid) TO service_role;
