-- Phase 2: Enable users to view their upline's profile
-- This policy allows users to SELECT the profile of the user who referred them

-- Drop the policy if it exists to recreate it cleanly
DROP POLICY IF EXISTS "Users can view their upline profile" ON profiles;

-- Create the policy to allow users to view their upline's profile
CREATE POLICY "Users can view their upline profile" 
ON profiles 
FOR SELECT 
USING (
  id IN (
    SELECT referrer_id 
    FROM referrals 
    WHERE referred_id = auth.uid() 
    AND status = 'active'
  )
);