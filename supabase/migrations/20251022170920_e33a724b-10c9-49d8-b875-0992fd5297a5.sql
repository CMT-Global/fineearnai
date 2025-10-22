-- Phase 1.3: Create Critical Indexes for Performance Optimization
-- These indexes prevent N+1 queries and improve performance at scale (1M+ users)

-- 1. Composite index for admin panel user-status queries
-- Speeds up queries filtering by user_id and status together
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_status
ON withdrawal_requests(user_id, status);

-- 2. Composite index for admin panel listing (status + created_at)
-- Optimizes the main admin withdrawal list ordered by creation date
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status_created
ON withdrawal_requests(status, created_at DESC);

-- 3. Index for general time-based queries
-- Speeds up queries ordering by created_at
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created_at
ON withdrawal_requests(created_at DESC);

-- 4. GIN index for withdrawal-related transaction metadata searches
-- Enables fast JSON searches in transaction metadata for withdrawal tracking
CREATE INDEX IF NOT EXISTS idx_transactions_withdrawal_metadata
ON transactions USING gin(metadata)
WHERE type = 'withdrawal';

-- 5. Add index on transactions for withdrawal lookups
-- Speeds up queries that filter transactions by type and user
CREATE INDEX IF NOT EXISTS idx_transactions_user_type
ON transactions(user_id, type);

-- 6. Add index for transaction status queries
-- Optimizes queries filtering by status (pending, completed, failed)
CREATE INDEX IF NOT EXISTS idx_transactions_status_created
ON transactions(status, created_at DESC);

-- Add comments for documentation
COMMENT ON INDEX idx_withdrawal_requests_user_status IS 
'Optimizes admin panel queries filtering withdrawals by user and status';

COMMENT ON INDEX idx_withdrawal_requests_status_created IS 
'Optimizes admin panel main withdrawal list ordered by creation date';

COMMENT ON INDEX idx_transactions_withdrawal_metadata IS 
'Enables fast JSON searches in transaction metadata for withdrawal tracking';

COMMENT ON INDEX idx_transactions_user_type IS 
'Speeds up user transaction history queries filtered by type';