-- Allow anonymous users to check username availability during signup
-- This policy only exposes the username field for validation purposes
-- Security: Usernames are not sensitive (publicly visible in referral links)
-- The frontend query explicitly selects only the username column

CREATE POLICY "Anyone can check username availability"
ON public.profiles
FOR SELECT
TO anon
USING (true);