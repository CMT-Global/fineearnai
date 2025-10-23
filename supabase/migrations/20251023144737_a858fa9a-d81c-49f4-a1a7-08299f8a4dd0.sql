-- Migration: Ensure Complete Payout Schedule (All 7 Days)
-- Purpose: Fix missing days in payout_schedule configuration
-- This migration ensures all days 0-6 (Sunday-Saturday) exist in the schedule

-- Function to ensure complete schedule with all 7 days
CREATE OR REPLACE FUNCTION ensure_complete_payout_schedule()
RETURNS void AS $$
DECLARE
  current_schedule JSONB;
  complete_schedule JSONB := '[]'::jsonb;
  day_exists BOOLEAN;
  day_config JSONB;
BEGIN
  -- Get current schedule
  SELECT value INTO current_schedule
  FROM platform_config
  WHERE key = 'payout_schedule';
  
  -- If no schedule exists, create default
  IF current_schedule IS NULL THEN
    current_schedule := '[]'::jsonb;
  END IF;
  
  -- Build complete schedule with all 7 days (0=Sunday to 6=Saturday)
  FOR day_num IN 0..6 LOOP
    -- Check if day exists in current schedule
    SELECT EXISTS (
      SELECT 1 FROM jsonb_array_elements(current_schedule) elem
      WHERE (elem->>'day')::integer = day_num
    ) INTO day_exists;
    
    IF day_exists THEN
      -- Use existing config (preserves enabled status and times)
      SELECT elem INTO day_config
      FROM jsonb_array_elements(current_schedule) elem
      WHERE (elem->>'day')::integer = day_num
      LIMIT 1;
    ELSE
      -- Create default config for missing day
      day_config := jsonb_build_object(
        'day', day_num,
        'enabled', false,
        'start_time', '00:00',
        'end_time', '23:59'
      );
    END IF;
    
    complete_schedule := complete_schedule || jsonb_build_array(day_config);
  END LOOP;
  
  -- Update platform_config with complete schedule
  UPDATE platform_config
  SET value = complete_schedule,
      updated_at = NOW()
  WHERE key = 'payout_schedule';
  
  RAISE NOTICE 'Payout schedule updated with all 7 days. Existing configurations preserved.';
END;
$$ LANGUAGE plpgsql;

-- Execute the function to fix current database state
SELECT ensure_complete_payout_schedule();

-- Drop the function (cleanup - no longer needed after migration)
DROP FUNCTION ensure_complete_payout_schedule();

-- Add comment to document this fix
COMMENT ON COLUMN platform_config.value IS 'Configuration value in JSONB format. For payout_schedule, must contain all 7 days (0-6).';