-- Enable realtime for transactions table
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;

-- Add composite index for user transactions query performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_created 
ON transactions(user_id, created_at DESC);

-- Add index for wallet type filtering
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_type 
ON transactions(user_id, wallet_type, created_at DESC);