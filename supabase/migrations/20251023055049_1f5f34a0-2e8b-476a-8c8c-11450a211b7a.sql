-- Phase 10.1: Fix payout_days type consistency (corrected approach)

-- Step 1: Convert payout_days from string array to integer array
UPDATE public.platform_config
SET value = (
  SELECT jsonb_agg((elem::text)::integer)
  FROM jsonb_array_elements_text(value) elem
)
WHERE key = 'payout_days'
AND jsonb_typeof(value) = 'array';

-- Step 2: Create validation function for payout_days
CREATE OR REPLACE FUNCTION public.validate_payout_days(config_value JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if it's an array
  IF jsonb_typeof(config_value) != 'array' THEN
    RETURN FALSE;
  END IF;
  
  -- Check if all elements are integers between 0 and 6
  RETURN (
    SELECT bool_and(
      jsonb_typeof(elem) = 'number' AND
      (elem::text)::integer BETWEEN 0 AND 6
    )
    FROM jsonb_array_elements(config_value) elem
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

-- Step 3: Add validation constraint using the function
ALTER TABLE public.platform_config
ADD CONSTRAINT check_payout_days_valid 
CHECK (
  key != 'payout_days' OR validate_payout_days(value)
);

-- Add helpful comments
COMMENT ON FUNCTION public.validate_payout_days(JSONB) IS 
'Validates that payout_days config is an array of integers between 0 (Sunday) and 6 (Saturday)';

COMMENT ON CONSTRAINT check_payout_days_valid ON public.platform_config IS 
'Ensures payout_days is an array of integers between 0 (Sunday) and 6 (Saturday)';