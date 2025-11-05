-- Ensure legacy key is aligned with verified domain (JSONB string)
UPDATE public.platform_config
SET value = to_jsonb('noreply@mail.fineearn.com'::text), updated_at = NOW()
WHERE key = 'email_from_address';

-- Seed if missing
INSERT INTO public.platform_config (key, value, description, created_at, updated_at)
SELECT 'email_from_address', to_jsonb('noreply@mail.fineearn.com'::text), 'Default FROM address for emails', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.platform_config WHERE key = 'email_from_address');