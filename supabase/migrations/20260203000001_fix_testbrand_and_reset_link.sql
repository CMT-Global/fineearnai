-- Migration to fix "testbrand" issues and ensure password reset links are working correctly
-- This migration specifically targets hardcoded "testbrand" values and ensures templates use correct variables

-- 1. Update Platform Config to ensure no "testbrand" remains
UPDATE public.platform_config
SET value = jsonb_set(
  value,
  '{name}',
  '"ProfitChips"'::jsonb
)
WHERE key = 'platform_branding' AND value->>'name' = 'testbrand';

UPDATE public.platform_config
SET value = jsonb_set(
  value,
  '{platform_name}',
  '"ProfitChips"'::jsonb
)
WHERE key = 'email_settings' AND value->>'platform_name' = 'testbrand';

UPDATE public.platform_config
SET value = '"ProfitChips"'::jsonb
WHERE key = 'platform_name' AND value = '"testbrand"'::jsonb;

-- 2. Fix the Global Email Template if it contains "testbrand"
UPDATE public.platform_config
SET value = jsonb_set(
  value,
  '{template}',
  to_jsonb(replace(value->>'template', 'testbrand', '{{platform_name}}'))
)
WHERE key = 'email_template_global' AND value->>'template' LIKE '%testbrand%';

-- 3. Fix the auth_password_reset template specifically
-- Ensure it has the correct subject and body with the reset_link variable
UPDATE public.email_templates
SET 
  subject = 'Reset Your ProfitChips Password',
  body = '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your ProfitChips Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; text-align: center; background: linear-gradient(135deg, #14532d 0%, #166534 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">ProfitChips</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 500;">Password Reset Request</p>
            </td>
          </tr>
          
          <!-- Body Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #1f2937;">
                Hello <strong style="color: #16a34a;">{{username}}</strong>,
              </p>
              
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                We received a request to reset your ProfitChips account password. Click the button below to create a new password and regain access to your account.
              </p>
              
              <!-- Reset Password Button -->
              <table role="presentation" style="margin: 32px 0; width: 100%;">
                <tr>
                  <td align="center">
                    <a href="{{reset_link}}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(22, 163, 74, 0.3);">Reset My Password</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 8px 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 32px 0; padding: 12px; font-size: 13px; line-height: 20px; color: #16a34a; background-color: #f3f4f6; border-radius: 6px; word-break: break-all; font-family: monospace;">
                {{reset_link}}
              </p>
              
              <div style=\"margin-top: 32px; padding: 20px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px;\">
                <p style=\"margin: 0 0 12px 0; font-size: 14px; line-height: 20px; color: #92400e; font-weight: 600;\">
                  ⚠️ Important Security Information
                </p>
                <ul style=\"margin: 0; padding-left: 20px; font-size: 14px; line-height: 22px; color: #92400e;\">
                  <li>This reset link expires in <strong>1 hour</strong></li>
                  <li>If you didn''t request this reset, please ignore this email</li>
                  <li>Never share this link with anyone</li>
                </ul>
              </div>
              
              <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                Need help? Contact our support team at <a href="mailto:support@profitchips.com" style="color: #16a34a; text-decoration: none;">support@profitchips.com</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
                This email was sent to <strong style="color: #1f2937;">{{email}}</strong>
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                © 2026 ProfitChips. All rights reserved. | Earn by Analyzing Reviews & Training AI
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
  is_active = true,
  updated_at = NOW()
WHERE template_type = 'auth_password_reset';

-- 4. General cleanup of any other templates that might have "testbrand" or old names
UPDATE public.email_templates
SET 
  subject = replace(replace(subject, 'testbrand', 'ProfitChips'), 'FineEarn', 'ProfitChips'),
  body = replace(replace(body, 'testbrand', 'ProfitChips'), 'FineEarn', 'ProfitChips')
WHERE subject ILIKE '%testbrand%' OR body ILIKE '%testbrand%'
   OR subject LIKE '%FineEarn%' OR body LIKE '%FineEarn%';

-- 5. Fix any "testbrand" in platform_config keys
UPDATE public.platform_config
SET value = to_jsonb('ProfitChips'::text)
WHERE value::text ILIKE '%testbrand%';

