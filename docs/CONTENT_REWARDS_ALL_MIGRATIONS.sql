-- ============================================================================
-- CONTENT REWARDS PROGRAM - COMPLETE MIGRATION SCRIPT
-- ============================================================================
-- Run these migrations in order in Supabase SQL Editor
-- Each section is idempotent (safe to run multiple times)
-- ============================================================================

-- ============================================================================
-- MIGRATION 1: Add Content Rewards fields to profiles table
-- ============================================================================
-- File: 20260205142000_add_content_rewards_fields.sql
-- Purpose: Adds columns to track Content Rewards participation
-- ============================================================================

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

-- ============================================================================
-- MIGRATION 2: Create referral_clicks table
-- ============================================================================
-- File: 20260205142001_create_referral_clicks_table.sql
-- Purpose: Tracks individual clicks on referral links with UTM parameters
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.referral_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  utm_source TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  ip_address TEXT,
  user_agent TEXT,
  converted_to_signup BOOLEAN NOT NULL DEFAULT false,
  converted_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_referral_clicks_referrer_id 
ON public.referral_clicks(referrer_id);

CREATE INDEX IF NOT EXISTS idx_referral_clicks_clicked_at 
ON public.referral_clicks(clicked_at);

CREATE INDEX IF NOT EXISTS idx_referral_clicks_converted 
ON public.referral_clicks(converted_to_signup) 
WHERE converted_to_signup = true;

CREATE INDEX IF NOT EXISTS idx_referral_clicks_utm_source 
ON public.referral_clicks(utm_source) 
WHERE utm_source IS NOT NULL;

-- Enable RLS
ALTER TABLE public.referral_clicks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own referral clicks
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'referral_clicks' 
    AND policyname = 'Users can view their own referral clicks'
  ) THEN
    CREATE POLICY "Users can view their own referral clicks"
    ON public.referral_clicks
    FOR SELECT
    USING (auth.uid() = referrer_id);
  END IF;
END $$;

-- Policy: Admins can view all referral clicks
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'referral_clicks' 
    AND policyname = 'Admins can view all referral clicks'
  ) THEN
    CREATE POLICY "Admins can view all referral clicks"
    ON public.referral_clicks
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
      )
    );
  END IF;
END $$;

-- ============================================================================
-- MIGRATION 3: Create admin functions for Content Rewards management
-- ============================================================================
-- File: 20260205142002_create_content_rewards_admin_functions.sql
-- Purpose: Creates RPC functions for admin to manage Content Rewards
-- IMPORTANT: This fixes the 404 error you're experiencing
-- ============================================================================

-- Function: Admin enable content rewards for a user
CREATE OR REPLACE FUNCTION public.admin_enable_content_rewards(
  p_user_id UUID,
  p_skip_onboarding BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_result JSONB;
BEGIN
  -- Check if current user is admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unauthorized',
      'message', 'Only admins can enable content rewards'
    );
  END IF;

  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'user_not_found',
      'message', 'User not found'
    );
  END IF;

  -- Update user profile
  UPDATE public.profiles
  SET 
    content_rewards_enabled = true,
    content_rewards_status = 'approved',
    content_rewards_onboarded_at = CASE 
      WHEN p_skip_onboarding THEN content_rewards_onboarded_at 
      ELSE COALESCE(content_rewards_onboarded_at, NOW()) 
    END
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Content rewards enabled successfully',
    'user_id', p_user_id
  );
END;
$$;

-- Function: Admin disable content rewards for a user
CREATE OR REPLACE FUNCTION public.admin_disable_content_rewards(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Check if current user is admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unauthorized',
      'message', 'Only admins can disable content rewards'
    );
  END IF;

  -- Update user profile
  UPDATE public.profiles
  SET 
    content_rewards_enabled = false,
    content_rewards_status = 'pending'
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Content rewards disabled successfully',
    'user_id', p_user_id
  );
END;
$$;

-- Function: Admin suspend content rewards for a user
CREATE OR REPLACE FUNCTION public.admin_suspend_content_rewards(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Check if current user is admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unauthorized',
      'message', 'Only admins can suspend content rewards'
    );
  END IF;

  -- Update user profile
  UPDATE public.profiles
  SET 
    content_rewards_status = 'suspended'
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Content rewards suspended successfully',
    'user_id', p_user_id
  );
END;
$$;

-- Function: Get content rewards stats for a creator
CREATE OR REPLACE FUNCTION public.get_content_rewards_stats(
  p_user_id UUID,
  p_date_from TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_date_to TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_stats JSONB;
  v_date_from TIMESTAMP WITH TIME ZONE;
  v_date_to TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Set default date range if not provided
  v_date_from := COALESCE(p_date_from, NOW() - INTERVAL '30 days');
  v_date_to := COALESCE(p_date_to, NOW());

  SELECT jsonb_build_object(
    'total_clicks', (
      SELECT COUNT(*)::INTEGER
      FROM public.referral_clicks
      WHERE referrer_id = p_user_id
      AND clicked_at >= v_date_from
      AND clicked_at <= v_date_to
    ),
    'total_signups', (
      SELECT COUNT(*)::INTEGER
      FROM public.referrals
      WHERE referrer_id = p_user_id
      AND created_at >= v_date_from
      AND created_at <= v_date_to
    ),
    'total_upgrades', (
      SELECT COUNT(DISTINCT t.user_id)::INTEGER
      FROM public.transactions t
      INNER JOIN public.referrals r ON r.referred_id = t.user_id
      WHERE r.referrer_id = p_user_id
      AND t.type = 'plan_upgrade'
      AND t.created_at >= v_date_from
      AND t.created_at <= v_date_to
    ),
    'total_earnings', (
      SELECT COALESCE(SUM(commission_amount), 0)::NUMERIC
      FROM public.referral_earnings
      WHERE referrer_id = p_user_id
      AND created_at >= v_date_from
      AND created_at <= v_date_to
    ),
    'upgrade_earnings', (
      SELECT COALESCE(SUM(commission_amount), 0)::NUMERIC
      FROM public.referral_earnings re
      INNER JOIN public.transactions t ON t.metadata->>'referred_user_id' = re.referred_user_id::TEXT
      WHERE re.referrer_id = p_user_id
      AND re.earning_type LIKE '%upgrade%'
      AND re.created_at >= v_date_from
      AND re.created_at <= v_date_to
    ),
    'task_earnings', (
      SELECT COALESCE(SUM(commission_amount), 0)::NUMERIC
      FROM public.referral_earnings
      WHERE referrer_id = p_user_id
      AND earning_type LIKE '%task%'
      AND created_at >= v_date_from
      AND created_at <= v_date_to
    )
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.admin_enable_content_rewards(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_disable_content_rewards(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_suspend_content_rewards(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_content_rewards_stats(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;

-- ============================================================================
-- MIGRATION 4: Seed default Content Rewards configuration
-- ============================================================================
-- File: 20260205142003_seed_content_rewards_config.sql
-- Purpose: Inserts default configuration that can be edited from admin panel
-- Note: Requires platform_config table to exist
-- ============================================================================

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

-- ============================================================================
-- VERIFICATION QUERIES (Optional - run these to verify migrations)
-- ============================================================================

-- Check if columns were added:
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' 
-- AND column_name LIKE 'content_rewards%';

-- Check if referral_clicks table exists:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name = 'referral_clicks';

-- Check if RPC functions exist:
-- SELECT routine_name 
-- FROM information_schema.routines 
-- WHERE routine_schema = 'public' 
-- AND routine_name LIKE '%content_rewards%';

-- Check if config was seeded:
-- SELECT key, description FROM public.platform_config 
-- WHERE key = 'content_rewards_config';

-- ============================================================================
-- END OF MIGRATIONS
-- ============================================================================
