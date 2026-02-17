-- Add 'expired' to account_status enum so we can store plan-expired state in DB.
-- Existing values: 'active', 'suspended', 'banned'.
-- Must be in a separate migration from the backfill UPDATE: new enum values
-- cannot be used in the same transaction (PostgreSQL 55P04).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'expired'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'account_status')
  ) THEN
    ALTER TYPE public.account_status ADD VALUE 'expired';
  END IF;
END
$$;
