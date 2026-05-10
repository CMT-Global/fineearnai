-- Update platform CHECK constraint to reflect allowed platforms only
-- Run in Supabase SQL Editor

ALTER TABLE public.content_reward_submissions
  DROP CONSTRAINT IF EXISTS content_reward_submissions_platform_check;

ALTER TABLE public.content_reward_submissions
  ADD CONSTRAINT content_reward_submissions_platform_check
  CHECK (platform IN ('tiktok', 'youtube_shorts', 'youtube_longform'));
