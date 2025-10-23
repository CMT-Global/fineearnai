-- Phase 1: Database Schema Fix - Convert payment_processor_id to UUID

-- Migration: Convert payment_processor_id from TEXT to UUID
-- This fixes the data type mismatch between withdrawal_requests and payment_processors
ALTER TABLE withdrawal_requests 
ALTER COLUMN payment_processor_id TYPE uuid USING payment_processor_id::uuid;

-- Add foreign key constraint for data integrity
-- Ensures payment_processor_id always references a valid processor
ALTER TABLE withdrawal_requests
ADD CONSTRAINT fk_withdrawal_payment_processor
FOREIGN KEY (payment_processor_id) 
REFERENCES payment_processors(id)
ON DELETE SET NULL;

-- Add index for performance on lookups
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_processor 
ON withdrawal_requests(payment_processor_id);

-- Add comment for documentation
COMMENT ON COLUMN withdrawal_requests.payment_processor_id IS 'Foreign key to payment_processors.id - stores processor configuration used for fee calculation';