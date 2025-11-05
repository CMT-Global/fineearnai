-- Phase 3: Add User Invite Email Template
-- Delete existing user_invite template if exists to ensure clean insert
DELETE FROM email_templates WHERE template_type = 'user_invite';

-- Insert User Invite Template
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
  'Platform User Invitation',
  'user_invite',
  'You''re Invited to Join FineEarn - Start Earning Today!',
  '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Join FineEarn</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to FineEarn!</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 18px; color: #555;">Hi <strong>{{invitee_name}}</strong>,</p>
    
    <p style="font-size: 16px; color: #666;">
      You''ve been invited to join <strong>FineEarn</strong>, the platform where you can earn money by training AI models through simple tasks.
    </p>
    
    <div style="background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0;">
      <h2 style="color: #667eea; margin-top: 0;">Why Join FineEarn?</h2>
      <ul style="color: #666; padding-left: 20px;">
        <li>✅ Earn money from home by completing AI training tasks</li>
        <li>✅ Flexible work schedule - work whenever you want</li>
        <li>✅ No special skills required - just basic comprehension</li>
        <li>✅ Get paid for your valuable contributions to AI development</li>
        <li>✅ Join thousands of users already earning on our platform</li>
      </ul>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{platform_url}}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-size: 18px; font-weight: bold; display: inline-block;">
        Join FineEarn Now
      </a>
    </div>
    
    <div style="background: #e8f4f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p style="margin: 0; color: #0066cc; font-weight: bold;">🎁 Special Signup Bonus: {{signup_bonus}}</p>
    </div>
    
    <p style="font-size: 14px; color: #888; margin-top: 30px;">
      If you have any questions, feel free to contact our support team at <a href="mailto:{{support_email}}" style="color: #667eea;">{{support_email}}</a>
    </p>
    
    <p style="font-size: 14px; color: #888;">
      Best regards,<br>
      <strong>The FineEarn Team</strong>
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>© 2024 FineEarn. All rights reserved.</p>
    <p>This is an invitation email. If you don''t want to join, you can safely ignore this message.</p>
  </div>
</body>
</html>',
  '["invitee_name", "platform_url", "signup_bonus", "support_email"]'::jsonb,
  true,
  NOW(),
  NOW()
);