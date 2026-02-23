-- Seed email templates for user-to-user transfers (Deposit Wallet)
-- Idempotent: only insert if template_type does not exist

-- 1. User Transfer OTP
INSERT INTO public.email_templates (
  name, subject, body, template_type, variables, is_active, updated_at
)
SELECT
  'User Transfer OTP',
  'Your transfer verification code: {{otp_code}}',
  '<p>Hi {{username}},</p>
<p>Use this code to confirm your transfer (reference: {{reference_id}}):</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px;">{{otp_code}}</p>
<p>This code expires in {{expires_in_minutes}} minutes. Do not share it with anyone.</p>',
  'user_transfer_otp',
  '["username", "otp_code", "expires_in_minutes", "reference_id"]'::jsonb,
  true,
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_type = 'user_transfer_otp');

-- 2. Sender confirmation (Funds Transfer Complete)
INSERT INTO public.email_templates (
  name, subject, body, template_type, variables, is_active, updated_at
)
SELECT
  'Funds Transfer Complete',
  'Transfer completed – {{amount}} {{currency}} sent to {{recipient_username}}',
  '<p>Hi {{sender_name}},</p>
<p>Your transfer has been completed successfully.</p>
<ul>
  <li><strong>Amount:</strong> {{amount}} {{currency}}</li>
  <li><strong>Recipient:</strong> {{recipient_name}} ({{recipient_username}})</li>
  <li><strong>Reference ID:</strong> {{reference_id}}</li>
  <li><strong>Date:</strong> {{created_at}}</li>
  <li><strong>Remaining Deposit Balance:</strong> {{remaining_deposit_balance}}</li>
</ul>
<p>Funds were deducted from your Deposit Wallet and added to the recipient''s Deposit Wallet.</p>',
  'user_transfer_sender_confirmation',
  '["sender_name", "sender_username", "recipient_name", "recipient_username", "amount", "currency", "reference_id", "created_at", "remaining_deposit_balance"]'::jsonb,
  true,
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_type = 'user_transfer_sender_confirmation');

-- 3. Recipient notification (You Received Funds)
INSERT INTO public.email_templates (
  name, subject, body, template_type, variables, is_active, updated_at
)
SELECT
  'You Received Funds',
  'You received {{amount}} {{currency}} from {{sender_username}}',
  '<p>Hi {{recipient_name}},</p>
<p>You have received <strong>{{amount}} {{currency}}</strong> from {{sender_name}} ({{sender_username}}).</p>
<p><strong>Reference ID:</strong> {{reference_id}}</p>
<p><strong>Date:</strong> {{created_at}}</p>
<p>Funds have been added to your Deposit Wallet and can be used for upgrades or other in-platform purchases.</p>',
  'user_transfer_recipient_notification',
  '["recipient_name", "recipient_username", "sender_name", "sender_username", "amount", "currency", "reference_id", "created_at"]'::jsonb,
  true,
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_type = 'user_transfer_recipient_notification');
