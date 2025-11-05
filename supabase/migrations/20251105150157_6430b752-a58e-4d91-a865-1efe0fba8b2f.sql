-- Add Influencer Invite Email Template
-- First check if template already exists
DO $$
BEGIN
  -- Delete existing influencer_invite template if it exists
  DELETE FROM email_templates WHERE template_type = 'influencer_invite';
  
  -- Insert new template
  INSERT INTO email_templates (
    name, 
    template_type, 
    subject, 
    body, 
    variables, 
    is_active
  ) VALUES (
    'Influencer Partner Invitation',
    'influencer_invite',
    'Join FineEarn as an Influencer Partner - Earn Up to 15% Commission',
    '<h2 style="color: #667eea; margin-bottom: 20px;">Hello {{influencer_name}},</h2>
    
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
      We are excited to invite you to become an official <strong>FineEarn Influencer Partner</strong>! 
      Your expertise in content creation and community building makes you an ideal fit for our growing platform.
    </p>
    
    <h3 style="color: #667eea; margin-top: 30px; margin-bottom: 15px;">🚀 Why Partner With FineEarn?</h3>
    
    <ul style="font-size: 15px; line-height: 1.8; margin-bottom: 25px;">
      <li><strong>Competitive Commissions:</strong> Earn up to <strong>{{commission_rate}}%</strong> on all referral deposits</li>
      <li><strong>Recurring Revenue:</strong> Earn commissions on every task your referrals complete</li>
      <li><strong>Exclusive Marketing Materials:</strong> Access professional banners, videos, and promotional content</li>
      <li><strong>Dedicated Support:</strong> Priority support from our partnership team</li>
      <li><strong>Real-Time Analytics:</strong> Track your performance with detailed dashboards</li>
    </ul>
    
    <h3 style="color: #667eea; margin-top: 30px; margin-bottom: 15px;">💰 Earning Potential</h3>
    
    <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
      As an influencer partner, you will earn:
    </p>
    
    <ul style="font-size: 15px; line-height: 1.8; margin-bottom: 25px;">
      <li><strong>Deposit Commissions:</strong> {{commission_rate}}% of every deposit made by your referrals</li>
      <li><strong>Task Commissions:</strong> Percentage of earnings from tasks completed by active referrals</li>
      <li><strong>Lifetime Value:</strong> Continue earning as long as your referrals remain active</li>
    </ul>
    
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #667eea;">
      <p style="margin: 0; font-size: 15px; line-height: 1.6;">
        <strong>Your Unique Referral Link:</strong><br/>
        <a href="{{referral_link}}" style="color: #667eea; text-decoration: none; font-weight: 600;">{{referral_link}}</a>
      </p>
    </div>
    
    <h3 style="color: #667eea; margin-top: 30px; margin-bottom: 15px;">📝 Next Steps</h3>
    
    <ol style="font-size: 15px; line-height: 1.8; margin-bottom: 25px;">
      <li>Click your referral link above to register or log in</li>
      <li>Complete your influencer profile setup</li>
      <li>Access your marketing dashboard and download promotional materials</li>
      <li>Start sharing with your community and earn commissions</li>
    </ol>
    
    <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
      Our partnership team is ready to support you every step of the way. 
      If you have any questions or need assistance, please don''t hesitate to reach out.
    </p>
    
    <p style="font-size: 15px; line-height: 1.6; margin-top: 30px;">
      Looking forward to a successful partnership!
    </p>
    
    <p style="font-size: 15px; line-height: 1.6; margin-top: 20px;">
      <strong>The FineEarn Partnership Team</strong><br/>
      <a href="mailto:{{support_email}}" style="color: #667eea; text-decoration: none;">{{support_email}}</a>
    </p>',
    '["influencer_name", "commission_rate", "referral_link", "support_email"]'::jsonb,
    true
  );
END $$;