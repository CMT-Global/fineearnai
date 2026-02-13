-- Fix: send-template-email looks up templates by template_type, not name.
-- The deposit confirmation template had template_type = 'transaction' but the code
-- requests template_type = 'deposit_confirmation'. Update so the lookup finds it.
UPDATE public.email_templates
SET template_type = 'deposit_confirmation',
    updated_at = NOW()
WHERE name = 'deposit_confirmation'
  AND (template_type IS DISTINCT FROM 'deposit_confirmation');
