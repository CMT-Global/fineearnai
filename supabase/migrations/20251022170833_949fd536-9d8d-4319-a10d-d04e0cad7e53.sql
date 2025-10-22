-- Phase 1.2: Add Database Constraints for Withdrawal Requests
-- These constraints prevent duplicate pending requests and ensure data integrity

-- 1. Add unique constraint to prevent duplicate pending withdrawal requests
-- This is a partial unique index that only applies when status = 'pending'
CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawal_requests_user_pending_unique
ON withdrawal_requests(user_id)
WHERE status = 'pending';

-- 2. Add check constraints for data validation
-- Ensure amounts are positive and fee is non-negative
ALTER TABLE withdrawal_requests
ADD CONSTRAINT chk_withdrawal_amounts 
CHECK (
  amount > 0 
  AND net_amount > 0 
  AND fee >= 0
);

-- 3. Add index on user_id for improved join performance
-- This speeds up queries that join withdrawal_requests with profiles
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id
ON withdrawal_requests(user_id);

-- 4. Add comment for documentation
COMMENT ON INDEX idx_withdrawal_requests_user_pending_unique IS 
'Prevents users from creating multiple pending withdrawal requests simultaneously';

COMMENT ON CONSTRAINT chk_withdrawal_amounts ON withdrawal_requests IS 
'Ensures withdrawal amounts are positive and fees are non-negative';