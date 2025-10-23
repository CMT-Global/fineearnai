-- Phase 1: Database Configuration for Manual Withdrawal Processing
-- This migration updates the payment processor configuration to reflect manual processing reality
-- and adds columns to track manual withdrawal execution

-- Step 1: Update "Crypto Payout" processor to reflect manual processing
UPDATE payment_processors
SET 
  processor_type = 'manual',
  config = jsonb_build_object(
    'processing_type', 'manual',
    'instructions', 'Admin must manually send cryptocurrency from external wallet to user address',
    'supported_networks', jsonb_build_array('TRC20', 'ERC20', 'BTC'),
    'note', 'CPAY only supports deposit/payment acceptance. Withdrawals require manual crypto transfers.',
    'requirements', jsonb_build_array(
      'External wallet with sufficient balance',
      'Blockchain transaction hash for confirmation',
      'Verification of recipient address'
    )
  )
WHERE name = 'Crypto Payout';

-- Step 2: Add columns to withdrawal_requests for manual processing tracking
ALTER TABLE withdrawal_requests
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS manual_txn_hash TEXT;

-- Step 3: Add comment to explain the columns
COMMENT ON COLUMN withdrawal_requests.admin_notes IS 'Notes added by admin during manual processing (approval reasons, issues, etc.)';
COMMENT ON COLUMN withdrawal_requests.manual_txn_hash IS 'Blockchain transaction hash from manual crypto transfer (proof of payment)';

-- Step 4: Create index on manual_txn_hash for lookup
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_manual_txn_hash 
ON withdrawal_requests(manual_txn_hash) 
WHERE manual_txn_hash IS NOT NULL;