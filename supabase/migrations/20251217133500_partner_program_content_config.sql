-- Seed partner_program_config configuration for enabling/disabling partner program
INSERT INTO public.platform_config (key, value, description)
VALUES (
  'partner_program_config',
  '{
    "isEnabled": true
  }'::jsonb,
  'Partner program global settings (enable/disable)'
)
ON CONFLICT (key) DO NOTHING;


-- Seed partner_program_content configuration for Become a Partner wizard
INSERT INTO public.platform_config (key, value, description)
VALUES (
  'partner_program_content',
  '{
    "wizard": {
      "isEnabled": true,
      "slides": [
        {
          "id": 1,
          "title": "Unlock Your Earning Potential",
          "headline": "Become a Local Partner",
          "body": "Become a Local Partner in your country and start earning by helping people in your community learn more about the platform and upgrade their accounts with local support."
        },
        {
          "id": 2,
          "title": "How Regular Users Benefit",
          "headline": "How Regular Users Benefit",
          "body": "Our Partner Network makes it easier than ever for our users to grow and succeed with local payment options and personal support."
        },
        {
          "id": 3,
          "title": "What Do Local Partners Do?",
          "headline": "Your Role is Simple & Profitable",
          "body": "Connect with users who want to upgrade, provide local support and guidance, sell vouchers seamlessly, and earn while helping others grow."
        },
        {
          "id": 4,
          "title": "How Users Benefit & You Profit",
          "headline": "The Secure Agent Deposit Flow",
          "body": "See how users upgrade safely through you while you earn guaranteed profit using the secure voucher and deposit flow."
        },
        {
          "id": 5,
          "title": "How You Make Money",
          "headline": "Crystal Clear Earnings",
          "body": "Understand exactly how much you earn per voucher and how your daily voucher sales scale into strong weekly income."
        },
        {
          "id": 6,
          "title": "Ready to Start Earning?",
          "headline": "You''re Almost There!",
          "body": "Join our growing network of successful partners earning daily income. The application takes less than 2 minutes."
        }
      ]
    }
  }'::jsonb,
  'Content configuration for Become a Partner wizard (high-level copy)'
)
ON CONFLICT (key) DO NOTHING;
