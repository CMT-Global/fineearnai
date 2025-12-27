-- Phase 1: Add referral_eligible column to membership_plans
-- This column controls whether users on this plan can generate referral commissions for their upline

DO $$
BEGIN
  -- Add referral_eligible column with default true (backward compatible)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'membership_plans' 
      AND column_name = 'referral_eligible'
  ) THEN
    ALTER TABLE membership_plans 
    ADD COLUMN referral_eligible BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

-- Set free plan to non-eligible (prevent free accounts from generating commissions)
UPDATE membership_plans 
SET referral_eligible = false 
WHERE account_type = 'free' OR name = 'free';

-- Ensure all paid plans are explicitly set to eligible
UPDATE membership_plans 
SET referral_eligible = true 
WHERE account_type IN ('personal', 'business', 'group') AND name != 'free';

-- Create index for performance (critical for 1M+ users)
CREATE INDEX IF NOT EXISTS idx_membership_plans_referral_eligible 
ON membership_plans(referral_eligible);

-- Add documentation comment
COMMENT ON COLUMN membership_plans.referral_eligible IS 'Controls whether users on this plan can generate referral commissions for their upline. Set to false for free plans to prevent commission generation.';