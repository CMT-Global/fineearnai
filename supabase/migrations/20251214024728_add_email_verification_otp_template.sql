-- Add Email Verification OTP Template
-- This template is used by the send-verification-otp edge function

-- Delete existing email_verification_otp template if exists to ensure clean insert
DELETE FROM email_templates WHERE template_type = 'email_verification_otp';

-- Insert Email Verification OTP Template
INSERT INTO email_templates (
  name, 
  template_type, 
  subject, 
  body, 
  variables, 
  is_active, 
  created_at,
  updated_at
) VALUES (
  'Email Verification OTP',
  'email_verification_otp',
  'Verify Your Email - Your Verification Code',
  '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Verification</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Verify Your Email</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 18px; color: #555;">Hi <strong>{{username}}</strong>,</p>
    
    <p style="font-size: 16px; color: #666;">
      Thank you for signing up! To complete your email verification, please use the verification code below:
    </p>
    
    <div style="background: white; padding: 30px; border: 2px solid #667eea; border-radius: 10px; margin: 30px 0; text-align: center;">
      <p style="font-size: 14px; color: #666; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
      <div style="font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: ''Courier New'', monospace;">
        {{otp_code}}
      </div>
    </div>
    
    <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
      <p style="margin: 0; color: #856404; font-size: 14px;">
        <strong>⏰ Important:</strong> This code will expire in {{expiry_minutes}} minutes. Please use it as soon as possible.
      </p>
    </div>
    
    <div style="background: #e8f4f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p style="margin: 0; color: #0066cc; font-size: 14px;">
        <strong>🔒 Security Tip:</strong> Never share this code with anyone. FineEarn staff will never ask for your verification code.
      </p>
    </div>
    
    <p style="font-size: 14px; color: #888; margin-top: 30px;">
      If you didn''t request this verification code, you can safely ignore this email. Your account will remain unverified until you complete the verification process.
    </p>
    
    <p style="font-size: 14px; color: #888;">
      Best regards,<br>
      <strong>The FineEarn Team</strong>
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>© 2024 FineEarn. All rights reserved.</p>
    <p>This email was sent to {{email}}</p>
  </div>
</body>
</html>',
  '["username", "otp_code", "email", "expiry_minutes"]'::jsonb,
  true,
  NOW(),
  NOW()
);
