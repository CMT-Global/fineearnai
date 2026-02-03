-- Migration to update email templates and platform branding from demo data to ProfitChips
-- Website Purpose: AI training platform where users earn money by completing tasks (like analyzing reviews) to improve AI models.

-- 1. Update Platform Branding and Name
INSERT INTO public.platform_config (key, value, description, updated_at)
VALUES 
  (
    'platform_branding', 
    '{"name": "ProfitChips", "url": "https://profitchips.com", "logoUrl": "/logo_without_bg_text.png"}'::jsonb, 
    'Platform branding settings', 
    NOW()
  ),
  (
    'platform_name', 
    '"ProfitChips"'::jsonb, 
    'Platform name used in communications', 
    NOW()
  ),
  (
    'email_settings',
    '{
      "from_name": "ProfitChips",
      "from_address": "noreply@profitchips.com",
      "reply_to_name": "ProfitChips Support",
      "reply_to_address": "support@profitchips.com",
      "platform_name": "ProfitChips",
      "platform_url": "https://profitchips.com"
    }'::jsonb,
    'Consolidated email settings',
    NOW()
  )
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- 2. Update Global Email Template
UPDATE public.platform_config
SET value = jsonb_set(
  value,
  '{template}',
  to_jsonb(replace(replace(value->>'template', 'FineEarn', 'ProfitChips'), 'Earn by Training AI', 'Earn by Analyzing Reviews & Training AI'))
)
WHERE key = 'email_template_global';

-- 3. Update all Email Templates
UPDATE public.email_templates
SET 
  subject = replace(subject, 'FineEarn', 'ProfitChips'),
  body = replace(
    replace(
      replace(body, 'FineEarn', 'ProfitChips'),
      'the platform where you can earn money by training AI models through simple tasks',
      'the platform where you can earn money by analyzing reviews and training AI models'
    ),
    'Empowering AI Training',
    'Earn by Analyzing Reviews & Training AI'
  )
WHERE body LIKE '%FineEarn%' OR subject LIKE '%FineEarn%';

-- 4. Specifically update descriptions in templates to match the website purpose
UPDATE public.email_templates
SET body = replace(body, 'AI training tasks', 'review analysis and AI training tasks')
WHERE template_type IN ('user_invite', 'influencer_invite');

-- 5. Fix any "test brand" or "test mail" that might be in the database (proactive)
UPDATE public.platform_config
SET value = to_jsonb('ProfitChips'::text)
WHERE value::text ILIKE '%test brand%';

UPDATE public.platform_config
SET value = to_jsonb('support@profitchips.com'::text)
WHERE value::text ILIKE '%test mail%';

UPDATE public.email_templates
SET 
  subject = replace(replace(subject, 'test brand', 'ProfitChips'), 'test mail', 'support@profitchips.com'),
  body = replace(replace(body, 'test brand', 'ProfitChips'), 'test mail', 'support@profitchips.com')
WHERE subject ILIKE '%test brand%' OR subject ILIKE '%test mail%' 
   OR body ILIKE '%test brand%' OR body ILIKE '%test mail%';
