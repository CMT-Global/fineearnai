-- Fix: Enable influencer/creator dashboard access for a user by email
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor) if the user still can't access the dashboard.
-- To enable yourself: replace the email below with YOUR login email.

UPDATE public.profiles
SET
  content_rewards_enabled = true,
  content_rewards_status = 'approved',
  content_rewards_onboarded_at = COALESCE(content_rewards_onboarded_at, NOW())
WHERE LOWER(TRIM(email)) = 'saurabh.excel2025@gmail.com';

-- If your profiles table has no email column, find the user in Supabase:
-- Authentication > Users > copy the user's UUID, then run:
-- UPDATE public.profiles
-- SET content_rewards_enabled = true, content_rewards_status = 'approved',
--     content_rewards_onboarded_at = COALESCE(content_rewards_onboarded_at, NOW())
-- WHERE id = 'paste-uuid-here';
