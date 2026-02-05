-- Seed default Content Rewards configuration
-- This config is editable from admin panel

INSERT INTO public.platform_config (key, value, description)
VALUES (
  'content_rewards_config',
  '{
    "enabled": false,
    "landing_page": {
      "title": "Get Paid to Post About ProfitChips",
      "description": "Create tutorials, share your link, and earn commissions when your referrals upgrade their subscription.",
      "hero_text": "Turn your content into earnings",
      "cta_text": "Apply & Start Posting"
    },
    "share_captions": {
      "tiktok": "Check out ProfitChips! Earn money by training AI. Use my link to get started: {link}",
      "youtube": "Learn how to earn online doing AI tasks with ProfitChips. Sign up using my referral link: {link}",
      "instagram": "Discover ProfitChips - earn by training AI! Use my link: {link}",
      "whatsapp": "Hey! Check out ProfitChips - you can earn money by training AI. Sign up here: {link}",
      "telegram": "Join ProfitChips and start earning! Use my link: {link}",
      "facebook": "Learn about ProfitChips - a platform where you earn by training AI. Sign up: {link}",
      "twitter": "Earn money training AI with ProfitChips! Sign up using my link: {link}"
    },
    "wizard_steps": {
      "step1_welcome": {
        "title": "Get Paid to Post About ProfitChips",
        "description": "Welcome to the Content Rewards Program! Create content, share your link, and earn commissions when your referrals upgrade."
      },
      "step2_what_to_post": {
        "title": "What to Post",
        "examples": [
          "Tutorial videos showing how to use ProfitChips",
          "How-to guides explaining the earning process",
          "Review videos sharing your experience",
          "Explainer videos: How to earn online doing AI tasks"
        ]
      },
      "step3_how_earnings_work": {
        "title": "How Earnings Work",
        "description": "You earn commissions when people you refer upgrade their subscription. Commission rates are based on your membership plan and are set by the admin."
      },
      "step4_goal_setting": {
        "title": "Set Your Goal",
        "message": "Creators often aim for $250/week (~$1,000/month) depending on performance and referrals. This is a target, not a guarantee."
      },
      "step5_get_link": {
        "title": "Get Your Creator Link",
        "description": "Your referral link tracks all signups and upgrades. Share it in your content to start earning commissions."
      },
      "step6_posting_checklist": {
        "title": "Posting Checklist",
        "dos": [
          "Use compliant language",
          "Be honest about earnings potential",
          "Focus on the value of the platform",
          "Include your referral link"
        ],
        "donts": [
          "Don''t promise fixed earnings",
          "Don''t use get rich quick language",
          "Don''t guarantee specific amounts",
          "Don''t make false claims"
        ],
        "compliant_language": "Earn commissions when your referrals upgrade. Earnings vary based on referrals and plan settings."
      },
      "step7_finish": {
        "title": "You''re Approved!",
        "message": "Start posting now and share your link to earn commissions. Check your dashboard to track your performance."
      }
    },
    "media_kit": {
      "assets": []
    },
    "goal_messaging": "Many creators set a goal of $250/week (~$1,000/month) depending on performance and referrals.",
    "disclaimer": "Earnings vary based on referrals, upgrades, and plan settings. No guaranteed earnings."
  }'::jsonb,
  'Content Rewards Program configuration. Editable from admin panel.'
)
ON CONFLICT (key) DO NOTHING;
