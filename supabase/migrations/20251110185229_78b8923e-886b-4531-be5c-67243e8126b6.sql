-- Add 'voucher_purchase' to transaction_type enum (idempotent)
-- This fixes the 500 error when partners purchase vouchers

DO $$ 
BEGIN
  -- Check if 'voucher_purchase' already exists in the enum
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_enum 
    WHERE enumlabel = 'voucher_purchase' 
    AND enumtypid = 'transaction_type'::regtype
  ) THEN
    -- Add the enum value if it doesn't exist
    ALTER TYPE transaction_type ADD VALUE 'voucher_purchase';
    
    RAISE NOTICE 'Added voucher_purchase to transaction_type enum';
  ELSE
    RAISE NOTICE 'voucher_purchase already exists in transaction_type enum';
  END IF;
END $$;