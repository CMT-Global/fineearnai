-- Phase 1: Add new fields to partner_applications table
-- Adding columns for enhanced partner application tracking

-- Add applicant country field
ALTER TABLE public.partner_applications 
ADD COLUMN IF NOT EXISTS applicant_country TEXT;

-- Add current membership plan at time of application
ALTER TABLE public.partner_applications 
ADD COLUMN IF NOT EXISTS current_membership_plan TEXT;

-- Add referral statistics
ALTER TABLE public.partner_applications 
ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0 NOT NULL;

ALTER TABLE public.partner_applications 
ADD COLUMN IF NOT EXISTS upgraded_referrals INTEGER DEFAULT 0 NOT NULL;

-- Add employment status
ALTER TABLE public.partner_applications 
ADD COLUMN IF NOT EXISTS is_currently_employed BOOLEAN;

-- Add daily time commitment (keeping weekly for backward compatibility)
ALTER TABLE public.partner_applications 
ADD COLUMN IF NOT EXISTS daily_time_commitment TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.partner_applications.applicant_country IS 'Country code of the applicant at time of application';
COMMENT ON COLUMN public.partner_applications.current_membership_plan IS 'Membership plan of applicant at time of application';
COMMENT ON COLUMN public.partner_applications.total_referrals IS 'Total number of referrals the applicant has';
COMMENT ON COLUMN public.partner_applications.upgraded_referrals IS 'Number of referrals who have upgraded from free plan';
COMMENT ON COLUMN public.partner_applications.is_currently_employed IS 'Whether the applicant is currently employed or has another job';
COMMENT ON COLUMN public.partner_applications.daily_time_commitment IS 'Daily time commitment for managing local users';

-- Create indexes for better query performance on large scale (1M+ users)
CREATE INDEX IF NOT EXISTS idx_partner_applications_country 
ON public.partner_applications(applicant_country);

CREATE INDEX IF NOT EXISTS idx_partner_applications_membership_plan 
ON public.partner_applications(current_membership_plan);

CREATE INDEX IF NOT EXISTS idx_partner_applications_total_referrals 
ON public.partner_applications(total_referrals);

-- Add constraint to ensure referral counts are non-negative
ALTER TABLE public.partner_applications 
ADD CONSTRAINT chk_total_referrals_non_negative 
CHECK (total_referrals >= 0);

ALTER TABLE public.partner_applications 
ADD CONSTRAINT chk_upgraded_referrals_non_negative 
CHECK (upgraded_referrals >= 0);

-- Add constraint to ensure upgraded referrals cannot exceed total referrals
ALTER TABLE public.partner_applications 
ADD CONSTRAINT chk_upgraded_referrals_valid 
CHECK (upgraded_referrals <= total_referrals);