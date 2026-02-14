-- Add 'referral_earning' to transaction_type enum (idempotent)
-- Fixes 22P02 when querying/inserting transactions with type referral_earning (e.g. signup bonus, admin Earned column)

DO $$ 
BEGIN
  -- Check if 'referral_earning' already exists in the enum
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_enum 
    WHERE enumlabel = 'referral_earning' 
    AND enumtypid = 'transaction_type'::regtype
  ) THEN
    -- Add the enum value if it doesn't exist
    ALTER TYPE transaction_type ADD VALUE 'referral_earning';
    
    RAISE NOTICE 'Added referral_earning to transaction_type enum';
  ELSE
    RAISE NOTICE 'referral_earning already exists in transaction_type enum';
  END IF;
END $$;
