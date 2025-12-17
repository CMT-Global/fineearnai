-- Add fee_savings_banner configuration to platform_config
INSERT INTO public.platform_config (key, value, description)
VALUES (
  'fee_savings_banner',
  '{
    "isVisible": true,
    "title": "⚡ Save on Fees!",
    "subtitle": "For the best experience, deposit using",
    "recommendedBadge": "Recommended",
    "option1": {
      "label": "⚡ USDC (Solana network)",
      "icon": "⚡"
    },
    "option2": {
      "label": "🚀 USDT - BEP20 (BSC Network)",
      "icon": "🚀"
    },
    "highlightText": "— especially for GCash/GCrypto users.",
    "benefitsText": "You''ll enjoy ultra-low fees and faster confirmations.",
    "footerText": "WE SUPPORT ALL OTHER COINS, YOU CAN CHOOSE ANY COIN."
  }'::jsonb,
  'Configuration for the fee savings banner shown on wallet page and deposit dialog'
)
ON CONFLICT (key) DO NOTHING;
