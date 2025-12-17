-- Update email domain from fineearn.com to profitchips.com
-- This migration updates all email-related configuration in platform_config

-- Update email_from_address
UPDATE public.platform_config
SET value = to_jsonb('noreply@profitchips.com'::text), updated_at = NOW()
WHERE key = 'email_from_address';

-- Update email_settings JSONB object
UPDATE platform_config 
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{from_address}',
  '"noreply@profitchips.com"'
)
WHERE key = 'email_settings';

-- Update email_reply_to if it exists
UPDATE public.platform_config
SET value = to_jsonb('support@profitchips.com'::text), updated_at = NOW()
WHERE key = 'email_reply_to';

-- Seed email_from_address if missing
INSERT INTO public.platform_config (key, value, description, created_at, updated_at)
SELECT 'email_from_address', to_jsonb('noreply@profitchips.com'::text), 'Default FROM address for emails', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.platform_config WHERE key = 'email_from_address');

-- Seed email_reply_to if missing
INSERT INTO public.platform_config (key, value, description, created_at, updated_at)
SELECT 'email_reply_to', to_jsonb('support@profitchips.com'::text), 'Default reply-to email address', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.platform_config WHERE key = 'email_reply_to');

