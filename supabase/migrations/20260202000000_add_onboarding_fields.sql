-- Add onboarding fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS weekly_goal TEXT,
ADD COLUMN IF NOT EXISTS weekly_time_commitment TEXT,
ADD COLUMN IF NOT EXISTS preferred_review_categories TEXT[],
ADD COLUMN IF NOT EXISTS weekly_routine TEXT,
ADD COLUMN IF NOT EXISTS recommended_plan_id UUID REFERENCES public.membership_plans(id),
ADD COLUMN IF NOT EXISTS selected_plan_id UUID REFERENCES public.membership_plans(id),
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS onboarding_version TEXT DEFAULT '1.0';

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.weekly_goal IS 'User weekly earning goal from onboarding';
COMMENT ON COLUMN public.profiles.weekly_time_commitment IS 'User weekly time commitment from onboarding';
COMMENT ON COLUMN public.profiles.preferred_review_categories IS 'User preferred review categories from onboarding';
COMMENT ON COLUMN public.profiles.weekly_routine IS 'User preferred weekly routine from onboarding';
COMMENT ON COLUMN public.profiles.onboarding_completed_at IS 'Timestamp when the user completed the onboarding wizard';
COMMENT ON COLUMN public.profiles.onboarding_version IS 'Version of the onboarding wizard completed by the user';
