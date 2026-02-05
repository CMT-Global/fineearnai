-- Add Content Rewards fields to profiles table
-- This enables tracking of users who are part of the Content Rewards program

DO $$ 
BEGIN
  -- Add content_rewards_enabled field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'content_rewards_enabled'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN content_rewards_enabled BOOLEAN NOT NULL DEFAULT false;
    
    RAISE NOTICE 'Added content_rewards_enabled column to profiles table';
  END IF;

  -- Add content_rewards_onboarded_at field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'content_rewards_onboarded_at'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN content_rewards_onboarded_at TIMESTAMP WITH TIME ZONE;
    
    RAISE NOTICE 'Added content_rewards_onboarded_at column to profiles table';
  END IF;

  -- Add content_rewards_status field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'content_rewards_status'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN content_rewards_status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (content_rewards_status IN ('pending', 'approved', 'suspended'));
    
    RAISE NOTICE 'Added content_rewards_status column to profiles table';
  END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_content_rewards_enabled 
ON public.profiles(content_rewards_enabled) 
WHERE content_rewards_enabled = true;

CREATE INDEX IF NOT EXISTS idx_profiles_content_rewards_status 
ON public.profiles(content_rewards_status);
