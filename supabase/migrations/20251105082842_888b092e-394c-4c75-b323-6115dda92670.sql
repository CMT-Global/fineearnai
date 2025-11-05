-- Update email sender to verified domain in platform_config
UPDATE platform_config 
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{from_address}',
  '"noreply@mail.fineearn.com"'
)
WHERE key = 'email_settings';