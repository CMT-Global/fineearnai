-- Seed dashboard content configuration for platform name-dependent sections
INSERT INTO public.platform_config (key, value, description)
VALUES (
  'dashboard_content',
  '{
    "earnersGuide": {
      "isVisible": true
    },
    "guidesSection": {
      "isVisible": true,
      "title": "\ud83d\udcb3 Deposit & Withdrawal Quick Guides",
      "description": "Learn how to fund your account and withdraw earnings using various payment methods globally"
    },
    "socialSection": {
      "isVisible": true,
      "facebookUrl": "https://facebook.com/ProfitChips",
      "instagramUrl": "https://www.instagram.com/ProfitChipsofficial/",
      "tiktokUrl": "https://www.tiktok.com/@ProfitChips"
    }
  }'::jsonb,
  'Dashboard content and visibility settings (earners guide, guides, social links)'
)
ON CONFLICT (key) DO NOTHING;
