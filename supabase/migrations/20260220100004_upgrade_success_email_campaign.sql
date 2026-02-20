-- Upgrade Success Email: campaign config + email template
-- Sent after successful account upgrade; can be enabled/disabled from admin.
-- All data is dynamic: first_name, login_url, plan, team invite link, task commissions, etc.

-- 1. Seed campaign config in platform_config (do not overwrite if key exists)
INSERT INTO public.platform_config (key, value, description, updated_at)
VALUES (
  'upgrade_success_email_campaign',
  '{"enabled": false}'::jsonb,
  'Account upgrade success email: enabled = send email after plan upgrade',
  now()
)
ON CONFLICT (key) DO NOTHING;

-- 2. Seed email template (idempotent by template_type)
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
  'Account Upgrade Success',
  'Your {{platform_name}} plan has been upgraded',
  '<p>Hi {{first_name}},</p>
<p>Good news — your {{platform_name}} membership has been successfully upgraded.</p>
<p>Your new plan benefits are now active, so you can log in and continue completing tasks with your updated limits and features:</p>
<p><a href="{{login_url}}">{{login_url}}</a></p>
<p><strong>Next steps (recommended):</strong></p>
<ul>
<li>Visit Tasks and start today''s work</li>
<li>Check your Membership page to see your new plan details</li>
<li>Share your Team Invite Link to start growing your team and earning additional commissions</li>
</ul>
<p><strong>Task commissions from your team:</strong> When people you invite join the platform and complete tasks, you earn commissions. So far you''ve earned <strong>{{task_commissions_earned}}</strong> from your referrals.</p>
<p>Share your invite link to grow your team: <a href="{{team_invite_link}}">{{team_invite_link}}</a></p>
<p>Need help? Talk to our support team on the 24/7 Livechat for assistance.</p>
<p>Happy Earnings,</p>
<p>— {{platform_name}} Team<br>{{support_email}}</p>',
  'account_upgrade_success',
  '["first_name", "login_url", "new_plan_name", "team_invite_link", "membership_url", "support_email", "platform_name", "task_commissions_earned"]'::jsonb,
  true,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE template_type = 'account_upgrade_success'
);
