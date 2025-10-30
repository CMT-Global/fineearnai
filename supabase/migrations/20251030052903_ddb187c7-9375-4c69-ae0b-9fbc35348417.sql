-- Add RLS policy to allow users to view their upline's profile
CREATE POLICY "Users can view their upline profile"
ON profiles FOR SELECT
USING (
  id IN (
    SELECT referrer_id 
    FROM referrals 
    WHERE referred_id = auth.uid()
      AND status = 'active'
  )
);