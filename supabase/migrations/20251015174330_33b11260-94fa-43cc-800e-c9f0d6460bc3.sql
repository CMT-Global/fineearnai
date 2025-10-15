-- Phase 3: Remove unused commission rate columns from referral_program_config
-- These fields are now configured per membership plan, not globally

ALTER TABLE referral_program_config 
DROP COLUMN IF EXISTS personal_deposit_commission_rate,
DROP COLUMN IF EXISTS business_task_commission_rate,
DROP COLUMN IF EXISTS business_deposit_commission_rate,
DROP COLUMN IF EXISTS personal_referrals_enabled,
DROP COLUMN IF EXISTS business_referrals_enabled;

-- Add comment to clarify the table's purpose
COMMENT ON TABLE referral_program_config IS 'Global referral program settings. Commission rates are configured per membership plan in the membership_plans table.';