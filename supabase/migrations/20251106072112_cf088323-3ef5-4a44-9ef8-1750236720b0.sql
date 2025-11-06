-- Phase 1: Database Schema Enhancement for Partner Applications
-- Add new fields for multi-step wizard form

-- ============================================================================
-- Section 1: Add New Columns (All nullable initially for backward compatibility)
-- ============================================================================

-- Section 2: Network & Experience
ALTER TABLE partner_applications
ADD COLUMN IF NOT EXISTS manages_community BOOLEAN,
ADD COLUMN IF NOT EXISTS community_group_links TEXT,
ADD COLUMN IF NOT EXISTS community_member_count TEXT,
ADD COLUMN IF NOT EXISTS promoted_platforms BOOLEAN,
ADD COLUMN IF NOT EXISTS platform_promotion_details TEXT,
ADD COLUMN IF NOT EXISTS network_description TEXT,
ADD COLUMN IF NOT EXISTS expected_monthly_onboarding TEXT;

-- Section 3: Local Payments & Support
ALTER TABLE partner_applications
ADD COLUMN IF NOT EXISTS local_payment_methods TEXT,
ADD COLUMN IF NOT EXISTS can_provide_local_support BOOLEAN,
ADD COLUMN IF NOT EXISTS support_preference TEXT,
ADD COLUMN IF NOT EXISTS organize_training_sessions BOOLEAN;

-- Section 4: Agreement
ALTER TABLE partner_applications
ADD COLUMN IF NOT EXISTS weekly_time_commitment TEXT,
ADD COLUMN IF NOT EXISTS motivation_text TEXT,
ADD COLUMN IF NOT EXISTS agrees_to_guidelines BOOLEAN;

-- ============================================================================
-- Section 2: Create Validation Function for Application Fields
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_partner_application()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate expected_monthly_onboarding enum values
  IF NEW.expected_monthly_onboarding IS NOT NULL AND 
     NEW.expected_monthly_onboarding NOT IN ('less_than_50', '50_100', '100_500', '500_plus') THEN
    RAISE EXCEPTION 'Invalid expected_monthly_onboarding value. Must be one of: less_than_50, 50_100, 100_500, 500_plus';
  END IF;

  -- Validate support_preference enum values
  IF NEW.support_preference IS NOT NULL AND 
     NEW.support_preference NOT IN ('direct_assistance', 'referral_only') THEN
    RAISE EXCEPTION 'Invalid support_preference value. Must be one of: direct_assistance, referral_only';
  END IF;

  -- Validate whatsapp_number is provided if preferred_contact_method includes whatsapp
  IF NEW.preferred_contact_method LIKE '%whatsapp%' AND 
     (NEW.whatsapp_number IS NULL OR NEW.whatsapp_number = '') THEN
    RAISE EXCEPTION 'WhatsApp number is required when WhatsApp is selected as a contact method';
  END IF;

  -- Validate telegram_username is provided if preferred_contact_method includes telegram
  IF NEW.preferred_contact_method LIKE '%telegram%' AND 
     (NEW.telegram_username IS NULL OR NEW.telegram_username = '') THEN
    RAISE EXCEPTION 'Telegram username is required when Telegram is selected as a contact method';
  END IF;

  -- Validate whatsapp_group_link format (basic URL validation)
  IF NEW.whatsapp_group_link IS NOT NULL AND NEW.whatsapp_group_link != '' AND
     NEW.whatsapp_group_link !~ '^https?://' THEN
    RAISE EXCEPTION 'WhatsApp group link must be a valid URL starting with http:// or https://';
  END IF;

  -- Validate telegram_group_link format (basic URL validation)
  IF NEW.telegram_group_link IS NOT NULL AND NEW.telegram_group_link != '' AND
     NEW.telegram_group_link !~ '^https?://' THEN
    RAISE EXCEPTION 'Telegram group link must be a valid URL starting with http:// or https://';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Section 3: Create Trigger for Validation
-- ============================================================================

DROP TRIGGER IF EXISTS validate_partner_application_trigger ON partner_applications;

CREATE TRIGGER validate_partner_application_trigger
  BEFORE INSERT OR UPDATE ON partner_applications
  FOR EACH ROW
  EXECUTE FUNCTION validate_partner_application();

-- ============================================================================
-- Section 4: Add Comments for Documentation
-- ============================================================================

COMMENT ON COLUMN partner_applications.manages_community IS 'Whether the applicant currently manages an online community or group';
COMMENT ON COLUMN partner_applications.community_group_links IS 'Links to communities managed by the applicant';
COMMENT ON COLUMN partner_applications.community_member_count IS 'Size/member count of managed communities';
COMMENT ON COLUMN partner_applications.promoted_platforms IS 'Whether applicant has promoted digital/online earning platforms before';
COMMENT ON COLUMN partner_applications.platform_promotion_details IS 'Details about previous platform promotion experience';
COMMENT ON COLUMN partner_applications.network_description IS 'Description of applicants network and why theyd be a great partner';
COMMENT ON COLUMN partner_applications.expected_monthly_onboarding IS 'Expected number of users to onboard in first month: less_than_50, 50_100, 100_500, 500_plus';
COMMENT ON COLUMN partner_applications.local_payment_methods IS 'Local payment methods the applicant can accept';
COMMENT ON COLUMN partner_applications.can_provide_local_support IS 'Whether applicant can provide local support via WhatsApp/Telegram';
COMMENT ON COLUMN partner_applications.support_preference IS 'Support preference: direct_assistance or referral_only';
COMMENT ON COLUMN partner_applications.organize_training_sessions IS 'Whether applicant is open to organizing training sessions';
COMMENT ON COLUMN partner_applications.weekly_time_commitment IS 'Time applicant can dedicate weekly to managing users';
COMMENT ON COLUMN partner_applications.motivation_text IS 'Applicants motivation for becoming a Local Partner';
COMMENT ON COLUMN partner_applications.agrees_to_guidelines IS 'Whether applicant agrees to follow Partner Guidelines';

-- ============================================================================
-- Section 5: Create Indexes for Performance (Supporting 1M+ users)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_partner_applications_manages_community 
  ON partner_applications(manages_community) 
  WHERE manages_community = true;

CREATE INDEX IF NOT EXISTS idx_partner_applications_expected_onboarding 
  ON partner_applications(expected_monthly_onboarding) 
  WHERE expected_monthly_onboarding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_partner_applications_support_preference 
  ON partner_applications(support_preference) 
  WHERE support_preference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_partner_applications_agrees_guidelines 
  ON partner_applications(agrees_to_guidelines) 
  WHERE agrees_to_guidelines = true;

-- ============================================================================
-- Section 6: Migration Complete - Ready for Phase 2
-- ============================================================================

-- All new fields added with backward compatibility
-- Validation triggers in place for data integrity
-- Indexes created for optimal query performance
-- Ready for frontend wizard implementation