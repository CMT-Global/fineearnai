-- Phase 1: Database Preparation & Backfill
-- Verify and backfill referrals table from profiles.referred_by

-- Step 1: Backfill missing referrals records from profiles.referred_by
-- This creates referral records for users who have referred_by set but no matching referrals entry
INSERT INTO public.referrals (
  referrer_id,
  referred_id,
  referral_code_used,
  total_commission_earned,
  status,
  created_at
)
SELECT 
  p.referred_by as referrer_id,
  p.id as referred_id,
  ref_profile.referral_code as referral_code_used,
  0.00 as total_commission_earned,
  'active' as status,
  p.created_at as created_at
FROM public.profiles p
INNER JOIN public.profiles ref_profile ON ref_profile.id = p.referred_by
LEFT JOIN public.referrals r ON r.referred_id = p.id
WHERE p.referred_by IS NOT NULL
  AND r.id IS NULL;

-- Step 2: Drop index on referred_by column if it exists
DROP INDEX IF EXISTS idx_profiles_referred_by;

-- Step 3: Log backfill results for verification
DO $$
DECLARE
  backfill_count INTEGER;
  total_referred_by INTEGER;
  total_referrals INTEGER;
BEGIN
  -- Count users with referred_by
  SELECT COUNT(*) INTO total_referred_by
  FROM public.profiles
  WHERE referred_by IS NOT NULL;
  
  -- Count referrals records
  SELECT COUNT(*) INTO total_referrals
  FROM public.referrals;
  
  RAISE NOTICE 'Phase 1 Complete: Users with referred_by: %, Total referrals records: %', 
    total_referred_by, total_referrals;
END $$;