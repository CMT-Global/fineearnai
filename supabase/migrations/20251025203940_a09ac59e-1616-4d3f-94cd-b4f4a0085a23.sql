-- Phase 5: Remove deprecated referred_by column from profiles table
-- All referral relationships are now handled through the referrals table

ALTER TABLE profiles DROP COLUMN IF EXISTS referred_by;