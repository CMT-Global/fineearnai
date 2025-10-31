-- Phase 1: Add allow_daily_withdrawals column to profiles table
-- This allows admins to grant specific users the ability to bypass payout schedule restrictions

ALTER TABLE public.profiles 
ADD COLUMN allow_daily_withdrawals BOOLEAN NOT NULL DEFAULT false;

-- Add documentation comment
COMMENT ON COLUMN public.profiles.allow_daily_withdrawals IS 
'When true, user can bypass payout schedule restrictions (day/time windows). Other limits still apply (min/max amounts, balance checks). Only modifiable by admins.';

-- Create partial index for efficient admin queries (only indexes rows where bypass is enabled)
CREATE INDEX idx_profiles_daily_withdrawal_bypass 
ON public.profiles(allow_daily_withdrawals) 
WHERE allow_daily_withdrawals = true;