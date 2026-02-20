-- Payout Day Reminder: logs table, campaign config, email templates
-- =============================================================================

-- 1. Create payout_reminder_logs table
CREATE TABLE IF NOT EXISTS public.payout_reminder_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payout_date DATE NOT NULL,
  hours_before INT NOT NULL,
  total_eligible INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payout_reminder_logs_payout_date
  ON public.payout_reminder_logs (payout_date DESC, hours_before);

-- Enable RLS
ALTER TABLE public.payout_reminder_logs ENABLE ROW LEVEL SECURITY;

-- Policy: admins can read only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payout_reminder_logs'
      AND policyname = 'Admins can view payout reminder logs'
  ) THEN
    CREATE POLICY "Admins can view payout reminder logs"
    ON public.payout_reminder_logs
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- 2. Seed campaign config in platform_config (do not overwrite if key exists)
INSERT INTO public.platform_config (key, value, description, updated_at)
VALUES (
  'payout_reminder_campaign',
  '{"enabled": false, "reminder_hours": [48, 24], "send_time_utc": "06:00"}'::jsonb,
  'Payout day reminder emails: enabled, reminder_hours (array), send_time_utc (HH:mm)',
  now()
)
ON CONFLICT (key) DO NOTHING;

-- 3. Seed email templates (idempotent by template_type)

-- 48 hours before payout day
INSERT INTO public.email_templates (
  name,
  subject,
  body,
  template_type,
  variables,
  is_active,
  updated_at
)
SELECT
  'Payout Reminder 48h',
  '🎉 {{payout_day}} is payday — payouts open in 48 hours',
  '<p>Hi {{first_name}},</p>
<p>Just a friendly heads-up — {{payout_day}} is payday (as usual) and payouts open in 48 hours ✅</p>
<p>To make sure everything goes smoothly, please take 1 minute today to:</p>
<ul>
<li>Check your payout details in Settings (so your withdrawal goes to the right place)</li>
<li>Complete your tasks for today & Confirm you have enough balance in your Earnings Wallet (withdrawals come from Earnings Wallet only- Minimum withdrawal is 10$)</li>
</ul>
<p>If you need help setting anything up, our team is available on 24/7 Live Chat at profitchips.com — just message us anytime.</p>
<p>See you on {{payout_day}} 🎊</p>
<p>— {{platform_name}} Team</p>',
  'payout_reminder_48h',
  '["first_name", "payout_day", "platform_name"]'::jsonb,
  true,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE template_type = 'payout_reminder_48h'
);

-- 24 hours before payout day
INSERT INTO public.email_templates (
  name,
  subject,
  body,
  template_type,
  variables,
  is_active,
  updated_at
)
SELECT
  'Payout Reminder 24h',
  '✅ Final reminder: {{payout_day}} payouts open tomorrow',
  '<p>Hi {{first_name}},</p>
<p>It''s almost time — {{payout_day}} is payday (as usual)</p>
<p>Quick checklist so you''re ready:</p>
<ul>
<li>Double-check your payout details in Settings</li>
<li>Make sure you''re withdrawing from your Earnings Wallet. Minimum withdrawal is only 10$</li>
</ul>
<p>When payouts open, you''ll be able to request your payout from Wallet → Withdrawals.</p>
<p>Questions? We''ve got you — reach us anytime via 24/7 Live Chat on profitchips.com.</p>
<p>Let''s gooo 💸</p>
<p>— {{platform_name}} Team</p>',
  'payout_reminder_24h',
  '["first_name", "payout_day", "platform_name"]'::jsonb,
  true,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE template_type = 'payout_reminder_24h'
);
