-- Function to validate payout schedule structure
CREATE OR REPLACE FUNCTION public.validate_payout_schedule(config_value JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  -- Must be an array
  IF jsonb_typeof(config_value) != 'array' THEN
    RETURN FALSE;
  END IF;
  
  -- Check all elements have valid structure
  RETURN (
    SELECT bool_and(
      (elem->>'day') IS NOT NULL AND
      (elem->>'day')::integer BETWEEN 0 AND 6 AND
      (elem->>'enabled') IS NOT NULL AND
      (elem->>'enabled')::boolean IS NOT NULL AND
      (elem->>'start_time') IS NOT NULL AND
      (elem->>'start_time') ~ '^\d{2}:\d{2}$' AND
      (elem->>'end_time') IS NOT NULL AND
      (elem->>'end_time') ~ '^\d{2}:\d{2}$' AND
      (elem->>'start_time') < (elem->>'end_time')
    )
    FROM jsonb_array_elements(config_value) elem
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public;

-- Create new payout_schedule config (replaces simple payout_days)
INSERT INTO public.platform_config (key, value, description)
VALUES (
  'payout_schedule',
  '[
    {"day": 1, "enabled": true, "start_time": "00:00", "end_time": "23:59"},
    {"day": 3, "enabled": true, "start_time": "00:00", "end_time": "23:59"},
    {"day": 5, "enabled": true, "start_time": "00:00", "end_time": "23:59"}
  ]'::jsonb,
  'Payout schedule with time windows (UTC). day: 0=Sunday-6=Saturday'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Add validation constraint for payout_schedule
ALTER TABLE public.platform_config
DROP CONSTRAINT IF EXISTS check_payout_schedule_valid;

ALTER TABLE public.platform_config
ADD CONSTRAINT check_payout_schedule_valid 
CHECK (
  key != 'payout_schedule' OR validate_payout_schedule(value)
);

-- Function to check if withdrawal is allowed now
CREATE OR REPLACE FUNCTION public.is_withdrawal_allowed()
RETURNS BOOLEAN AS $$
DECLARE
  schedule JSONB;
  current_day INTEGER;
  utc_time TEXT;
  day_schedule JSONB;
BEGIN
  -- Get current UTC day and time
  current_day := EXTRACT(DOW FROM (NOW() AT TIME ZONE 'UTC'))::INTEGER;
  utc_time := TO_CHAR((NOW() AT TIME ZONE 'UTC'), 'HH24:MI');
  
  -- Get schedule
  SELECT value INTO schedule
  FROM public.platform_config
  WHERE key = 'payout_schedule';
  
  IF schedule IS NULL THEN
    -- Fallback to old payout_days config
    SELECT value INTO schedule
    FROM public.platform_config
    WHERE key = 'payout_days';
    
    IF schedule IS NOT NULL AND jsonb_typeof(schedule) = 'array' THEN
      -- Check if current day is in the array
      IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(schedule) elem 
        WHERE elem::text::integer = current_day
      ) THEN
        RETURN TRUE;
      ELSE
        RETURN FALSE;
      END IF;
    ELSE
      RETURN FALSE;
    END IF;
  END IF;
  
  -- Check schedule for current day
  SELECT elem INTO day_schedule
  FROM jsonb_array_elements(schedule) elem
  WHERE (elem->>'day')::integer = current_day
  AND (elem->>'enabled')::boolean = true
  LIMIT 1;
  
  IF day_schedule IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check time window
  IF utc_time >= (day_schedule->>'start_time') AND 
     utc_time <= (day_schedule->>'end_time') THEN
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_withdrawal_allowed() TO authenticated;