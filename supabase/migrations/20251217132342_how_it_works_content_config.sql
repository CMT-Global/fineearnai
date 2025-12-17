-- Seed how_it_works_content configuration for How It Works page
INSERT INTO public.platform_config (key, value, description)
VALUES (
  'how_it_works_content',
  '{
    "isVisible": true,
    "slides": [
      {
        "id": 1,
        "title": "What Is ProfitChips?",
        "subtitle": "Your Gateway to Earning with AI",
        "description": "ProfitChips is a revolutionary platform that connects you with AI training tasks, enabling you to earn real money by contributing to the advancement of artificial intelligence."
      },
      {
        "id": 2,
        "title": "How You Earn",
        "subtitle": "Simple Tasks, Real Rewards",
        "description": "Every task you complete correctly earns you money that goes directly into your earnings wallet. Your earning rate depends on your membership plan."
      },
      {
        "id": 3,
        "title": "Types of Tasks",
        "subtitle": "Variety of AI Microtasks",
        "description": "ProfitChips offers diverse AI training tasks that help improve machine learning models. Each task is simple but contributes to advancing AI technology."
      },
      {
        "id": 4,
        "title": "When You Get Paid",
        "subtitle": "Real-Time Tracking & Weekly Payouts",
        "description": "Your earnings are tracked in real-time and available for withdrawal on designated payout days. Watch your wallet grow with every completed task!"
      },
      {
        "id": 5,
        "title": "Withdrawals",
        "subtitle": "Easy & Convenient Cashouts",
        "description": "Withdrawing your earnings is simple and secure. Choose from multiple payment methods and receive your money quickly."
      },
      {
        "id": 6,
        "title": "Upgrading Your Account",
        "subtitle": "Boost Your Earning Potential",
        "description": "Upgrade your membership to unlock higher earnings, more daily tasks, and exclusive benefits. Invest in your earning potential today!"
      },
      {
        "id": 7,
        "title": "Invite & Earn",
        "subtitle": "Build Your Team",
        "description": "Grow your income by referring others to ProfitChips. Earn commissions from your referrals'' activities and build a sustainable passive income stream."
      },
      {
        "id": 8,
        "title": "Ready to Start?",
        "subtitle": "Begin Your Journey",
        "description": "You''re all set! Head to your dashboard to start completing tasks and earning money. Remember to check out the membership plans to maximize your earning potential."
      }
    ]
  }'::jsonb,
  'How It Works page content (visibility and per-slide copy)'
)
ON CONFLICT (key) DO NOTHING;


