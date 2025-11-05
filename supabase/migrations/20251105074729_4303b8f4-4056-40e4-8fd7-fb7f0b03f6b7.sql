-- Update the existing default_password_reset template with FineEarn branding
UPDATE email_templates
SET 
  subject = 'Reset Your FineEarn Password',
  body = '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your FineEarn Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- FineEarn Header -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; text-align: center; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">FineEarn</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 500;">Password Reset Request</p>
            </td>
          </tr>
          
          <!-- Body Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #1f2937;">
                Hello <strong style="color: #4F46E5;">{{username}}</strong>,
              </p>
              
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4b5563;">
                We received a request to reset your FineEarn account password. Click the button below to create a new password and regain access to your account.
              </p>
              
              <!-- Reset Password Button -->
              <table role="presentation" style="margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="{{reset_link}}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.3);">Reset My Password</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 8px 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 32px 0; padding: 12px; font-size: 13px; line-height: 20px; color: #4F46E5; background-color: #f3f4f6; border-radius: 6px; word-break: break-all; font-family: monospace;">
                {{reset_link}}
              </p>
              
              <!-- Security Notice -->
              <div style="margin-top: 32px; padding: 20px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px;">
                <p style="margin: 0 0 12px 0; font-size: 14px; line-height: 20px; color: #92400e; font-weight: 600;">
                  ⚠️ Important Security Information
                </p>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 22px; color: #92400e;">
                  <li>This reset link expires in <strong>1 hour</strong></li>
                  <li>If you didn''t request this reset, please ignore this email</li>
                  <li>Your password won''t change until you complete the reset process</li>
                  <li>Never share this link with anyone</li>
                </ul>
              </div>
              
              <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                Need help? Contact our support team at <a href="mailto:support@fineearn.com" style="color: #4F46E5; text-decoration: none;">support@fineearn.com</a>
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
                © 2025 FineEarn. All rights reserved. | Empowering AI Training
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Email Client Notice -->
        <p style="margin: 20px 0 0 0; font-size: 12px; color: #9ca3af; text-align: center;">
          This is an automated message. Please do not reply to this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>',
  updated_at = NOW()
WHERE template_type = 'auth_password_reset'
AND name = 'default_password_reset';