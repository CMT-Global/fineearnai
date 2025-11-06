-- ============================================================================
-- Update validate_partner_application function to accept new enum values
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_partner_application()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate expected_monthly_onboarding enum values (UNCHANGED)
  IF NEW.expected_monthly_onboarding IS NOT NULL AND 
     NEW.expected_monthly_onboarding NOT IN ('less_than_50', '50_100', '100_500', '500_plus') THEN
    RAISE EXCEPTION 'Invalid expected_monthly_onboarding value. Must be one of: less_than_50, 50_100, 100_500, 500_plus';
  END IF;

  -- Validate support_preference enum values (UPDATED TO NEW VALUES)
  IF NEW.support_preference IS NOT NULL AND 
     NEW.support_preference NOT IN ('online', 'in_person', 'both') THEN
    RAISE EXCEPTION 'Invalid support_preference value. Must be one of: online, in_person, both';
  END IF;

  -- Validate daily_time_commitment enum values (NEW VALIDATION)
  IF NEW.daily_time_commitment IS NOT NULL AND 
     NEW.daily_time_commitment NOT IN ('1-2', '2-4', '4-6', '6+') THEN
    RAISE EXCEPTION 'Invalid daily_time_commitment value. Must be one of: 1-2, 2-4, 4-6, 6+';
  END IF;

  -- Validate whatsapp_number is provided if preferred_contact_method includes whatsapp (UNCHANGED)
  IF NEW.preferred_contact_method LIKE '%whatsapp%' AND 
     (NEW.whatsapp_number IS NULL OR NEW.whatsapp_number = '') THEN
    RAISE EXCEPTION 'WhatsApp number is required when WhatsApp is selected as a contact method';
  END IF;

  -- Validate telegram_username is provided if preferred_contact_method includes telegram (UNCHANGED)
  IF NEW.preferred_contact_method LIKE '%telegram%' AND 
     (NEW.telegram_username IS NULL OR NEW.telegram_username = '') THEN
    RAISE EXCEPTION 'Telegram username is required when Telegram is selected as a contact method';
  END IF;

  -- Validate whatsapp_group_link format (UNCHANGED)
  IF NEW.whatsapp_group_link IS NOT NULL AND NEW.whatsapp_group_link != '' AND
     NEW.whatsapp_group_link !~ '^https?://' THEN
    RAISE EXCEPTION 'WhatsApp group link must be a valid URL starting with http:// or https://';
  END IF;

  -- Validate telegram_group_link format (UNCHANGED)
  IF NEW.telegram_group_link IS NOT NULL AND NEW.telegram_group_link != '' AND
     NEW.telegram_group_link !~ '^https?://' THEN
    RAISE EXCEPTION 'Telegram group link must be a valid URL starting with http:// or https://';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comment
COMMENT ON FUNCTION validate_partner_application() IS 'Validates partner application fields before INSERT/UPDATE. Updated to support new support_preference values (online, in_person, both) and new daily_time_commitment values (1-2, 2-4, 4-6, 6+).';