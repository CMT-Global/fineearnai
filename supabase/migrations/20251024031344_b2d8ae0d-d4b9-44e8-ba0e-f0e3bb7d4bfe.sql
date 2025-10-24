-- Phase 1: Database Cleanup & Schema Updates

-- Drop obsolete manual tracking infrastructure
DROP VIEW IF EXISTS manual_withdrawal_metrics;
DROP TABLE IF EXISTS manual_withdrawal_tracking;

-- Add API tracking columns to withdrawal_requests
ALTER TABLE withdrawal_requests 
ADD COLUMN IF NOT EXISTS api_response JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS payment_provider TEXT;

-- Update existing 'approved_manual' to 'pending' (cleanup old data)
UPDATE withdrawal_requests 
SET status = 'pending' 
WHERE status = 'approved_manual';

-- Add comment for documentation
COMMENT ON COLUMN withdrawal_requests.api_response IS 'Stores API response data including errors for failed transactions';
COMMENT ON COLUMN withdrawal_requests.payment_provider IS 'Payment provider used for withdrawal (cpay, payeer, etc.)';