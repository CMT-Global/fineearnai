-- Post-Upgrade Team Commissions (6-email sequence): tables, campaign config, email templates
-- Trigger: first upgrade only. Schedule and content fully editable from admin.
-- =============================================================================

-- 1. Enrollment table (one row per user; first upgrade only)
CREATE TABLE IF NOT EXISTS public.post_upgrade_team_commissions_enrollment (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  sequence_name TEXT NOT NULL DEFAULT 'post_upgrade_team_commissions',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'stopped', 'completed')),
  upgraded_at TIMESTAMPTZ NOT NULL,
  current_step SMALLINT NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  step_sent_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_upgrade_team_commissions_enrollment_status_upgraded
  ON public.post_upgrade_team_commissions_enrollment (status, upgraded_at);
CREATE INDEX IF NOT EXISTS idx_post_upgrade_team_commissions_enrollment_user_id
  ON public.post_upgrade_team_commissions_enrollment (user_id);

ALTER TABLE public.post_upgrade_team_commissions_enrollment ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'post_upgrade_team_commissions_enrollment'
      AND policyname = 'Admins can view post upgrade team commissions enrollment'
  ) THEN
    CREATE POLICY "Admins can view post upgrade team commissions enrollment"
    ON public.post_upgrade_team_commissions_enrollment
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- 2. Run logs table
CREATE TABLE IF NOT EXISTS public.post_upgrade_team_commissions_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_date DATE NOT NULL,
  total_eligible INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_upgrade_team_commissions_logs_run_date
  ON public.post_upgrade_team_commissions_logs (run_date DESC);

ALTER TABLE public.post_upgrade_team_commissions_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'post_upgrade_team_commissions_logs'
      AND policyname = 'Admins can view post upgrade team commissions logs'
  ) THEN
    CREATE POLICY "Admins can view post upgrade team commissions logs"
    ON public.post_upgrade_team_commissions_logs
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- 3. Campaign config (steps: day_offset 0, 2, 5, 8, 12, 15)
INSERT INTO public.platform_config (key, value, description, updated_at)
VALUES (
  'post_upgrade_team_commissions_campaign',
  '{
    "enabled": false,
    "require_email_verified": true,
    "send_time_utc": "09:00",
    "steps": [
      {"step_index": 1, "day_offset": 0, "template_type": "post_upgrade_team_1", "is_active": true},
      {"step_index": 2, "day_offset": 2, "template_type": "post_upgrade_team_2", "is_active": true},
      {"step_index": 3, "day_offset": 5, "template_type": "post_upgrade_team_3", "is_active": true},
      {"step_index": 4, "day_offset": 8, "template_type": "post_upgrade_team_4", "is_active": true},
      {"step_index": 5, "day_offset": 12, "template_type": "post_upgrade_team_5", "is_active": true},
      {"step_index": 6, "day_offset": 15, "template_type": "post_upgrade_team_6", "is_active": true}
    ]
  }'::jsonb,
  'Post-Upgrade Team Commissions (6-step): enabled, require_email_verified, send_time_utc, steps with day_offset and template_type',
  now()
)
ON CONFLICT (key) DO NOTHING;

-- 4. Email templates (6 steps) – idempotent by template_type
-- Email 1 — Day 0 (Unlock + link)
INSERT INTO public.email_templates (name, subject, body, template_type, variables, is_active, updated_at)
SELECT
  'Post-Upgrade Team – Day 0 (Unlock Task Commissions)',
  'You''ve unlocked Task Commissions 🎉',
  '<p>Hi {{first_name}},</p>
<p>Welcome aboard — your account is now active, and you''ve unlocked Task Commissions allowing you to earn an extra 280$ weekly in task commissions.</p>
<p>When you invite friends to ProfitChips, you can earn extra commissions whenever your team members complete tasks (as long as both accounts are upgraded).</p>
<ul>
<li>✅ Added automatically to your Earnings Wallet</li>
<li>✅ Your team still earns their full reward — your commission is extra</li>
<li>✅ No fixed cap — your team''s activity drives your potential</li>
</ul>
<p>Your Team Invite Link:<br/><a href="{{team_invite_url}}">{{team_invite_url}}</a></p>
<p>— ProfitChips Team</p>',
  'post_upgrade_team_1',
  '["first_name", "team_invite_url", "team_guide_url"]'::jsonb,
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_type = 'post_upgrade_team_1');

-- Email 2 — Day 2 (Rules + trust)
INSERT INTO public.email_templates (name, subject, body, template_type, variables, is_active, updated_at)
SELECT
  'Post-Upgrade Team – Day 2 (4 simple rules)',
  'Task Commissions: 4 simple rules (important)',
  '<p>Hi {{first_name}},</p>
<p>Here''s exactly how Task Commissions work:</p>
<p><strong>Locked on Free Accounts</strong><br/>Task commissions only apply when both accounts are upgraded (anti-fraud policy).</p>
<p><strong>Paid per task</strong><br/>You earn up to 10% of what your team member earns per task.</p>
<p><strong>Unlimited potential</strong><br/>The more active your team is, the more you can earn and you can have unlimited team members working under you.</p>
<p><strong>Your team member is not charged</strong><br/>ProfitChips pays your commission — it does not reduce their earnings.</p>
<p>Start inviting your team here: <a href="{{team_invite_url}}">{{team_invite_url}}</a></p>
<p>— ProfitChips Team</p>',
  'post_upgrade_team_2',
  '["first_name", "team_invite_url", "team_guide_url"]'::jsonb,
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_type = 'post_upgrade_team_2');

-- Email 3 — Day 5 (Example with numbers)
INSERT INTO public.email_templates (name, subject, body, template_type, variables, is_active, updated_at)
SELECT
  'Post-Upgrade Team – Day 5 (Real example)',
  'Real example: what one active team member can earn you',
  '<p>Hi {{first_name}},</p>
<p>Here''s a simple example to make task commissions clear:</p>
<p>If a team member earns $0.40 per task and completes 50 tasks/day, they earn:<br/>$0.40 × 50 = $20/day</p>
<p>If your commission is 10%, you earn:<br/>10% of $20 = $2/day from that one member<br/>That''s $14/week from 1 active team member.</p>
<p>Now the team effect:</p>
<ul>
<li>10 active team members → $14 × 10 = $140/week</li>
<li>20 active team members → $14 × 20 = $280/week</li>
</ul>
<p>Your results depend on plan settings and team activity — but this is the exact formula.</p>
<p>Your Team Invite Link: <a href="{{team_invite_url}}">{{team_invite_url}}</a></p>
<p>— ProfitChips Team</p>',
  'post_upgrade_team_3',
  '["first_name", "team_invite_url", "team_guide_url"]'::jsonb,
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_type = 'post_upgrade_team_3');

-- Email 4 — Day 8 (Copy/paste scripts)
INSERT INTO public.email_templates (name, subject, body, template_type, variables, is_active, updated_at)
SELECT
  'Post-Upgrade Team – Day 8 (Copy & paste messages)',
  'Copy & paste these messages to invite your first 5 members',
  '<p>Hi {{first_name}},</p>
<p>The easiest way to grow commissions is to invite a few friends and help them start correctly.</p>
<p>Here are ready-to-send messages:</p>
<p><strong>Message 1 (short):</strong><br/>"Hey! I''m using ProfitChips to earn online by completing simple tasks. You can try it free for 3 days. Join with my link: {{team_invite_url}}"</p>
<p><strong>Message 2 (trust + clarity):</strong><br/>"It''s task-based online earning (not trading). You complete simple tasks, track progress on your dashboard, and withdraw based on the platform schedule. Try it here: {{team_invite_url}}"</p>
<p><strong>Message 3 (team support):</strong><br/>"If you join using my link, I''ll show you exactly how to set up and start smoothly. Free trial here: {{team_invite_url}}"</p>
<p>Your Team Invite Link: <a href="{{team_invite_url}}">{{team_invite_url}}</a></p>
<p>— ProfitChips Team</p>',
  'post_upgrade_team_4',
  '["first_name", "team_invite_url", "team_guide_url"]'::jsonb,
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_type = 'post_upgrade_team_4');

-- Email 5 — Day 12 (Ethical FOMO)
INSERT INTO public.email_templates (name, subject, body, template_type, variables, is_active, updated_at)
SELECT
  'Post-Upgrade Team – Day 12 (Build your team early)',
  'Build your team early (before access becomes tighter)',
  '<p>Hi {{first_name}},</p>
<p>As ProfitChips grows, we plan to move toward invite-only onboarding in the future to protect task quality and keep the platform fair.</p>
<p>That means people who join early through your link may have an easier time getting started.</p>
<p>If you want to build a strong team, now is a good time to start:<br/><a href="{{team_invite_url}}">{{team_invite_url}}</a></p>
<p>— ProfitChips Team</p>',
  'post_upgrade_team_5',
  '["first_name", "team_invite_url", "team_guide_url"]'::jsonb,
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_type = 'post_upgrade_team_5');

-- Email 6 — Day 15 (Routine + guide)
INSERT INTO public.email_templates (name, subject, body, template_type, variables, is_active, updated_at)
SELECT
  'Post-Upgrade Team – Day 15 (Weekly routine)',
  'Your simple weekly routine: tasks + team growth',
  '<p>Hi {{first_name}},</p>
<p>Most top earners build consistency with two habits:</p>
<ol>
<li>Complete tasks regularly (steady personal earnings)</li>
<li>Build a small team and help them stay active (steady commissions)</li>
</ol>
<p>Even 5–10 active team members can add meaningful weekly commissions over time, depending on plan settings and activity.</p>
<p>Your Team Invite Link is here anytime: <a href="{{team_invite_url}}">{{team_invite_url}}</a></p>
<p>Need help explaining it? Share the guide: <a href="{{team_guide_url}}">{{team_guide_url}}</a></p>
<p>— ProfitChips Team</p>',
  'post_upgrade_team_6',
  '["first_name", "team_invite_url", "team_guide_url"]'::jsonb,
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_type = 'post_upgrade_team_6');
