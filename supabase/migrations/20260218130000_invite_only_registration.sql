-- Invite-Only Registration Mode: tables, config, and email templates

-- 1. Enum for invite request status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invite_request_status') THEN
    CREATE TYPE public.invite_request_status AS ENUM (
      'pending_email_verification',
      'verified',
      'invite_sent'
    );
  END IF;
END$$;

-- 2. Table invite_requests
CREATE TABLE IF NOT EXISTS public.invite_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  country TEXT,
  country_code TEXT,
  status public.invite_request_status NOT NULL DEFAULT 'pending_email_verification',
  email_verified_at TIMESTAMPTZ,
  invite_sent_at TIMESTAMPTZ,
  assigned_referrer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_referral_code TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_ip TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invite_requests_email ON public.invite_requests(email);
CREATE INDEX IF NOT EXISTS idx_invite_requests_status ON public.invite_requests(status);
CREATE INDEX IF NOT EXISTS idx_invite_requests_requested_at ON public.invite_requests(requested_at);
CREATE INDEX IF NOT EXISTS idx_invite_requests_request_ip ON public.invite_requests(request_ip);

ALTER TABLE public.invite_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view invite_requests" ON public.invite_requests;
CREATE POLICY "Admins can view invite_requests"
  ON public.invite_requests FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update invite_requests" ON public.invite_requests;
CREATE POLICY "Admins can update invite_requests"
  ON public.invite_requests FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- No INSERT policy for authenticated users: only edge (service role) creates rows.

-- 3. Table invite_request_otps
CREATE TABLE IF NOT EXISTS public.invite_request_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_request_id UUID NOT NULL REFERENCES public.invite_requests(id) ON DELETE CASCADE,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invite_request_otps_invite_request ON public.invite_request_otps(invite_request_id);
CREATE INDEX IF NOT EXISTS idx_invite_request_otps_expires ON public.invite_request_otps(expires_at);

ALTER TABLE public.invite_request_otps ENABLE ROW LEVEL SECURITY;

-- No policies: only service role (edge functions) can access; service role bypasses RLS.

-- 4. Table invite_request_events (audit / anti-abuse)
CREATE TABLE IF NOT EXISTS public.invite_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_request_id UUID NOT NULL REFERENCES public.invite_requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invite_request_events_request ON public.invite_request_events(invite_request_id);
CREATE INDEX IF NOT EXISTS idx_invite_request_events_type ON public.invite_request_events(event_type);

ALTER TABLE public.invite_request_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view invite_request_events" ON public.invite_request_events;
CREATE POLICY "Admins can view invite_request_events"
  ON public.invite_request_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Edge functions use service role and bypass RLS to insert events.

-- 5. platform_config: invite_only_registration_config
INSERT INTO public.platform_config (key, value, description, updated_at)
VALUES (
  'invite_only_registration_config',
  '{
    "invite_only_mode": false,
    "referral_cookie_duration_days": 30,
    "enable_invite_requests": true,
    "default_invite_referrer_username": "",
    "landing_banner_title": "We are now invite-only",
    "landing_banner_description": "We are onboarding in batches to protect task quality and keep access fair. Request an invite to get started.",
    "invite_required_message_title": "Invite Required",
    "invite_required_message_description": "Registration is by invite only. Request an invite below or use your invite link to sign up.",
    "request_submitted_success_message": "Check your email for a verification code. Enter it below to receive your invite link."
  }'::jsonb,
  'Invite-only registration: toggles, copy, and default referrer',
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 6. Email templates: invite_request_otp and invite_link
DELETE FROM public.email_templates WHERE template_type = 'invite_request_otp';
INSERT INTO public.email_templates (
  name, template_type, subject, body, variables, is_active, created_at, updated_at
) VALUES (
  'Invite Request OTP',
  'invite_request_otp',
  'Verify your email – {{site_name}} invite',
  '<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Verify your email</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Verify your email</h1>
  </div>
  <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px;">Hi <strong>{{name}}</strong>,</p>
    <p style="font-size: 16px; color: #666;">Use this code to verify your email and receive your invite link:</p>
    <div style="background: white; padding: 24px; border: 2px solid #667eea; border-radius: 10px; margin: 20px 0; text-align: center;">
      <div style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 6px; font-family: monospace;">{{otp_code}}</div>
    </div>
    <p style="font-size: 14px; color: #666;">This code expires in {{otp_expiry_minutes}} minutes. If you did not request this, you can ignore this email.</p>
    <p style="font-size: 14px; color: #888;">Need help? Contact {{support_url}}</p>
    <p style="font-size: 14px; color: #888;">— {{site_name}}</p>
  </div>
</body>
</html>',
  '["name", "email", "country", "otp_code", "otp_expiry_minutes", "support_url", "site_name"]'::jsonb,
  true,
  NOW(),
  NOW()
);

DELETE FROM public.email_templates WHERE template_type = 'invite_link';
INSERT INTO public.email_templates (
  name, template_type, subject, body, variables, is_active, created_at, updated_at
) VALUES (
  'Your Invite Link',
  'invite_link',
  'Your {{site_name}} invite – Create your account',
  '<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Your invite</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">You''re invited</h1>
  </div>
  <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px;">Hi <strong>{{name}}</strong>,</p>
    <p style="font-size: 16px; color: #666;">Your email is verified. Use the button below to create your account.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{invite_link}}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">Create your account</a>
    </div>
    <p style="font-size: 14px; color: #888;">Or copy this link: {{invite_link}}</p>
    <p style="font-size: 14px; color: #888;">Need help? {{support_url}} — {{site_name}}</p>
  </div>
</body>
</html>',
  '["name", "email", "country", "invite_link", "support_url", "site_name"]'::jsonb,
  true,
  NOW(),
  NOW()
);
