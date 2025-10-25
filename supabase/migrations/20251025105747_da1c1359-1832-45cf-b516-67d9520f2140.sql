-- Phase 3: Clean up existing duplicates before adding unique constraints
-- Strategy: Delete duplicate transactions (keep earliest), then add unique indexes

-- Step 1: Delete duplicate completed deposits by gateway_transaction_id
-- Keep the EARLIEST transaction (created_at ASC), delete all others
WITH duplicate_deposits AS (
  SELECT 
    id,
    user_id,
    gateway_transaction_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, gateway_transaction_id 
      ORDER BY created_at ASC
    ) as row_num
  FROM transactions
  WHERE type = 'deposit'
    AND status = 'completed'
    AND gateway_transaction_id IS NOT NULL
)
DELETE FROM transactions
WHERE id IN (
  SELECT id FROM duplicate_deposits WHERE row_num > 1
);

-- Step 2: Delete duplicate completed deposits by order_id (metadata-based)
-- Keep the EARLIEST transaction, delete all others
WITH duplicate_orders AS (
  SELECT 
    id,
    user_id,
    metadata->>'order_id' as order_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, (metadata->>'order_id')
      ORDER BY created_at ASC
    ) as row_num
  FROM transactions
  WHERE type = 'deposit'
    AND status = 'completed'
    AND metadata->>'order_id' IS NOT NULL
    AND metadata->>'order_id' != ''
)
DELETE FROM transactions
WHERE id IN (
  SELECT id FROM duplicate_orders WHERE row_num > 1
);

-- Step 3: Now create the unique indexes (no more duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_completed_deposits 
ON transactions (gateway_transaction_id, user_id) 
WHERE type = 'deposit' 
  AND status = 'completed' 
  AND gateway_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_order_deposits
ON transactions (user_id, ((metadata->>'order_id')::text)) 
WHERE type = 'deposit' 
  AND status = 'completed' 
  AND (metadata->>'order_id') IS NOT NULL
  AND (metadata->>'order_id') != '';

-- Add helpful comments
COMMENT ON INDEX idx_unique_completed_deposits IS 'Database-level duplicate prevention: ensures same gateway_transaction_id creates only one completed deposit per user';
COMMENT ON INDEX idx_unique_order_deposits IS 'Database-level duplicate prevention: ensures same order_id creates only one completed deposit per user';