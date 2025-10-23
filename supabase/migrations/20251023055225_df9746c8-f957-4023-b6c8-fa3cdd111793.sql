-- Phase 10.2: Add UTC Timezone Enforcement

-- Function to get current UTC day of week (0=Sunday, 6=Saturday)
CREATE OR REPLACE FUNCTION public.get_current_utc_day()
RETURNS INTEGER AS $$
BEGIN
  RETURN EXTRACT(DOW FROM (NOW() AT TIME ZONE 'UTC'))::INTEGER;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Function to get current UTC time (HH:MM format)
CREATE OR REPLACE FUNCTION public.get_current_utc_time()
RETURNS TEXT AS $$
BEGIN
  RETURN TO_CHAR((NOW() AT TIME ZONE 'UTC'), 'HH24:MI');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_current_utc_day() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_utc_time() TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.get_current_utc_day() IS 
'Returns current day of week in UTC (0=Sunday, 6=Saturday)';

COMMENT ON FUNCTION public.get_current_utc_time() IS 
'Returns current time in UTC in HH24:MI format';