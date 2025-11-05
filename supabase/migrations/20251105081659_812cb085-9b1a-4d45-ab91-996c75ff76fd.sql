-- Phase 2: Configure Email Settings for Password Reset System
-- Add email configuration to platform_config for send-template-email function

-- Insert email settings if they don't exist
INSERT INTO platform_config (key, value, description, created_at, updated_at)
VALUES 
  (
    'email_from_address',
    '"noreply@fineearn.com"'::jsonb,
    'Default sender email address for all platform emails',
    NOW(),
    NOW()
  ),
  (
    'email_from_name',
    '"FineEarn"'::jsonb,
    'Default sender name for all platform emails',
    NOW(),
    NOW()
  ),
  (
    'email_reply_to',
    '"support@fineearn.com"'::jsonb,
    'Default reply-to email address for all platform emails',
    NOW(),
    NOW()
  ),
  (
    'platform_name',
    '"FineEarn"'::jsonb,
    'Platform name used in email templates and communications',
    NOW(),
    NOW()
  )
ON CONFLICT (key) DO NOTHING;

-- Add comment for documentation
COMMENT ON COLUMN platform_config.key IS 'Configuration key identifier (email_from_address, email_from_name, email_reply_to, platform_name, etc.)';
COMMENT ON COLUMN platform_config.value IS 'Configuration value stored as JSONB (must be valid JSON format)';

-- Verify auth_password_reset template exists and is active
DO $$
DECLARE
  template_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO template_count
  FROM email_templates
  WHERE template_type = 'auth_password_reset' AND is_active = true;
  
  IF template_count = 0 THEN
    RAISE NOTICE 'WARNING: auth_password_reset email template is missing or inactive. Password reset emails will fail!';
  ELSE
    RAISE NOTICE 'SUCCESS: auth_password_reset email template is active and ready';
  END IF;
END $$;