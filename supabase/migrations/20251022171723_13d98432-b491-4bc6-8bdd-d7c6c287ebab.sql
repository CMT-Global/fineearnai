-- Phase 4.1: Add Foreign Key for Withdrawal Requests to Enable Join Queries
-- This foreign key enables efficient joins and eliminates N+1 queries in admin panel

-- Add foreign key constraint from withdrawal_requests.user_id to profiles.id
ALTER TABLE withdrawal_requests
ADD CONSTRAINT fk_withdrawal_requests_user_id 
FOREIGN KEY (user_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;

-- Add comment for documentation
COMMENT ON CONSTRAINT fk_withdrawal_requests_user_id ON withdrawal_requests IS 
'Links withdrawal requests to user profiles, enables efficient join queries in admin panel';