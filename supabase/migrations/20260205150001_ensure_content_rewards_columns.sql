-- Ensure content_rewards columns exist on profiles (idempotent).
-- Run this if user detail page fails with "Edge Function returned a non-2xx status code"
-- because get_user_detail_aggregated references these columns.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'content_rewards_enabled') THEN
    ALTER TABLE public.profiles ADD COLUMN content_rewards_enabled BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'content_rewards_onboarded_at') THEN
    ALTER TABLE public.profiles ADD COLUMN content_rewards_onboarded_at TIMESTAMP WITH TIME ZONE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'content_rewards_status') THEN
    ALTER TABLE public.profiles ADD COLUMN content_rewards_status TEXT NOT NULL DEFAULT 'pending' CHECK (content_rewards_status IN ('pending', 'approved', 'suspended'));
  END IF;
END $$;
