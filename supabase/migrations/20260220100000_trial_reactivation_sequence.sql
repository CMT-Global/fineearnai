-- Trial Reactivation (7-email sequence): tables, campaign config, email templates
-- =============================================================================

-- 1. Sequence tracking table
CREATE TABLE IF NOT EXISTS public.trial_reactivation_sequence (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  expiry_date DATE NOT NULL,
  last_step_sent SMALLINT NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trial_reactivation_sequence_status_expiry
  ON public.trial_reactivation_sequence (status, expiry_date);
CREATE INDEX IF NOT EXISTS idx_trial_reactivation_sequence_user_id
  ON public.trial_reactivation_sequence (user_id);

ALTER TABLE public.trial_reactivation_sequence ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'trial_reactivation_sequence'
      AND policyname = 'Admins can view trial reactivation sequence'
  ) THEN
    CREATE POLICY "Admins can view trial reactivation sequence"
    ON public.trial_reactivation_sequence
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- 2. Run logs table
CREATE TABLE IF NOT EXISTS public.trial_reactivation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_date DATE NOT NULL,
  total_eligible INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trial_reactivation_logs_run_date
  ON public.trial_reactivation_logs (run_date DESC);

ALTER TABLE public.trial_reactivation_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'trial_reactivation_logs'
      AND policyname = 'Admins can view trial reactivation logs'
  ) THEN
    CREATE POLICY "Admins can view trial reactivation logs"
    ON public.trial_reactivation_logs
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- 3. Campaign config
INSERT INTO public.platform_config (key, value, description, updated_at)
VALUES (
  'trial_reactivation_campaign',
  '{"enabled": false, "send_time_utc": "06:00", "require_email_verified": true}'::jsonb,
  'Trial Expiry Reactivation (7-step): enabled, send_time_utc (HH:mm), require_email_verified',
  now()
)
ON CONFLICT (key) DO NOTHING;

-- 4. Email templates (7 steps) – idempotent insert by template_type
INSERT INTO public.email_templates (name, subject, body, template_type, variables, is_active, updated_at)
SELECT 'Trial Reactivation – Day 0', 'Your {{platform_name}} access is paused — reactivate to continue',
  '<p>Hi {{first_name}},</p>
<p>Your 3-day trial has ended, so task access on your {{platform_name}} account is now paused.</p>
<p>To continue completing tasks and earning, reactivate your account anytime — plans start from ${{plan_price_from}}/year.</p>
<p>Reactivate here: <a href="{{upgrade_url}}">{{upgrade_url}}</a></p>
<p>If you still have questions, feel free to talk to us on Livechat on {{platform_name}}.com</p>
<p>— {{platform_name}} Team</p>',
  'trial_reactivation_1',
  '["first_name", "login_url", "upgrade_url", "help_center_url", "plan_price_from", "platform_name"]'::jsonb,
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_type = 'trial_reactivation_1');

INSERT INTO public.email_templates (name, subject, body, template_type, variables, is_active, updated_at)
SELECT 'Trial Reactivation – Day 1', 'What you unlock when you activate your account',
  '<p>Hi {{first_name}},</p>
<p>When you activate your {{platform_name}} account, you unlock:</p>
<ul>
<li>Daily access to available tasks (while your plan is active)</li>
<li>Higher earning potential with higher plans</li>
<li>The ability to build a team and earn commissions (paid plans)</li>
<li>Full access to your dashboard and progress tools</li>
</ul>
<p>Reactivate from ${{plan_price_from}}/year here: <a href="{{upgrade_url}}">{{upgrade_url}}</a></p>
<p>If you still have questions, feel free to talk to us on Livechat on {{platform_name}}.com</p>
<p>— {{platform_name}} Team</p>',
  'trial_reactivation_2',
  '["first_name", "login_url", "upgrade_url", "help_center_url", "plan_price_from", "platform_name"]'::jsonb,
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_type = 'trial_reactivation_2');

INSERT INTO public.email_templates (name, subject, body, template_type, variables, is_active, updated_at)
SELECT 'Trial Reactivation – Day 3', 'Why {{platform_name}} requires activation (and how it protects real users)',
  '<p>Hi {{first_name}},</p>
<p>{{platform_name}} is open to users worldwide. To keep tasks available for serious contributors and reduce spam/multiple accounts, we use an annual activation model.</p>
<p>This helps us:</p>
<ul>
<li>Protect task quality</li>
<li>Keep the platform fair</li>
<li>Support users consistently at scale</li>
</ul>
<p>If you''re ready to continue, reactivate here (from ${{plan_price_from}}/year):<br/><a href="{{upgrade_url}}">{{upgrade_url}}</a></p>
<p>If you still have questions, feel free to talk to us on Livechat on {{platform_name}}.com</p>
<p>— {{platform_name}} Team</p>',
  'trial_reactivation_3',
  '["first_name", "login_url", "upgrade_url", "help_center_url", "plan_price_from", "platform_name"]'::jsonb,
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_type = 'trial_reactivation_3');

INSERT INTO public.email_templates (name, subject, body, template_type, variables, is_active, updated_at)
SELECT 'Trial Reactivation – Day 5', 'Reactivate in 60 seconds (quick steps)',
  '<p>Hi {{first_name}},</p>
<p>Reactivating is quick:</p>
<ol>
<li>Log in: <a href="{{login_url}}">{{login_url}}</a></li>
<li>Go to Upgrade/Plans</li>
<li>Choose your plan</li>
<li>Activate — task access resumes instantly</li>
</ol>
<p>Reactivate now: <a href="{{upgrade_url}}">{{upgrade_url}}</a></p>
<p>If you still have questions, feel free to talk to us on Livechat on {{platform_name}}.com</p>
<p>— {{platform_name}} Team</p>',
  'trial_reactivation_4',
  '["first_name", "login_url", "upgrade_url", "help_center_url", "plan_price_from", "platform_name"]'::jsonb,
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_type = 'trial_reactivation_4');

INSERT INTO public.email_templates (name, subject, body, template_type, variables, is_active, updated_at)
SELECT 'Trial Reactivation – Day 7', 'Don''t miss today''s tasks — reactivate your access',
  '<p>Hi {{first_name}},</p>
<p>New tasks rotate daily, and your account is currently paused because your trial ended.</p>
<p>If you want to continue, reactivate your access from ${{plan_price_from}}/year:<br/><a href="{{upgrade_url}}">{{upgrade_url}}</a></p>
<p>If you''re unsure which plan to pick, start with the recommended plan shown on the upgrade page.</p>
<p>If you still have questions, feel free to talk to us on Livechat on {{platform_name}}.com</p>
<p>— {{platform_name}} Team</p>',
  'trial_reactivation_5',
  '["first_name", "login_url", "upgrade_url", "help_center_url", "plan_price_from", "platform_name"]'::jsonb,
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_type = 'trial_reactivation_5');

INSERT INTO public.email_templates (name, subject, body, template_type, variables, is_active, updated_at)
SELECT 'Trial Reactivation – Day 10', 'Earn more by building your team (paid plans)',
  '<p>Hi {{first_name}},</p>
<p>Many users grow faster by inviting friends and building a small team. On paid plans, you unlock team/task commissions—so you can earn extra rewards when your team completes tasks.</p>
<p>You can reactivate now from ${{plan_price_from}}/year:<br/><a href="{{upgrade_url}}">{{upgrade_url}}</a></p>
<p>If you still have questions, feel free to talk to us on Livechat on {{platform_name}}.com</p>
<p>— {{platform_name}} Team</p>',
  'trial_reactivation_6',
  '["first_name", "login_url", "upgrade_url", "help_center_url", "plan_price_from", "platform_name"]'::jsonb,
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_type = 'trial_reactivation_6');

INSERT INTO public.email_templates (name, subject, body, template_type, variables, is_active, updated_at)
SELECT 'Trial Reactivation – Day 14', 'Last reminder: reactivate anytime to continue',
  '<p>Hi {{first_name}},</p>
<p>Just a final reminder—your {{platform_name}} account is still paused because the trial ended.</p>
<p>If you''d like to continue completing tasks and earning, you can reactivate anytime from ${{plan_price_from}}/year:<br/><a href="{{upgrade_url}}">{{upgrade_url}}</a></p>
<p>If you still have questions, feel free to talk to us on Livechat on {{platform_name}}.com</p>
<p>— {{platform_name}} Team</p>',
  'trial_reactivation_7',
  '["first_name", "login_url", "upgrade_url", "help_center_url", "plan_price_from", "platform_name"]'::jsonb,
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_type = 'trial_reactivation_7');
