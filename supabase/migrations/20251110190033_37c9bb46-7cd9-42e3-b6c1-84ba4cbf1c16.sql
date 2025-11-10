-- Add recipient tracking columns to vouchers table (idempotent)
-- This migration adds recipient_username and recipient_email columns
-- to track who vouchers are purchased for

-- Add recipient_username column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vouchers' 
    AND column_name = 'recipient_username'
  ) THEN
    ALTER TABLE public.vouchers 
    ADD COLUMN recipient_username TEXT;
    
    RAISE NOTICE 'Added recipient_username column to vouchers table';
  ELSE
    RAISE NOTICE 'recipient_username column already exists in vouchers table';
  END IF;
END $$;

-- Add recipient_email column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vouchers' 
    AND column_name = 'recipient_email'
  ) THEN
    ALTER TABLE public.vouchers 
    ADD COLUMN recipient_email TEXT;
    
    RAISE NOTICE 'Added recipient_email column to vouchers table';
  ELSE
    RAISE NOTICE 'recipient_email column already exists in vouchers table';
  END IF;
END $$;

-- Create index on recipient_username for fast lookups (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'vouchers' 
    AND indexname = 'idx_vouchers_recipient_username'
  ) THEN
    CREATE INDEX idx_vouchers_recipient_username ON public.vouchers(recipient_username);
    RAISE NOTICE 'Created index idx_vouchers_recipient_username';
  ELSE
    RAISE NOTICE 'Index idx_vouchers_recipient_username already exists';
  END IF;
END $$;

-- Create index on recipient_email for fast lookups (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'vouchers' 
    AND indexname = 'idx_vouchers_recipient_email'
  ) THEN
    CREATE INDEX idx_vouchers_recipient_email ON public.vouchers(recipient_email);
    RAISE NOTICE 'Created index idx_vouchers_recipient_email';
  ELSE
    RAISE NOTICE 'Index idx_vouchers_recipient_email already exists';
  END IF;
END $$;

-- Add helpful comment
COMMENT ON COLUMN public.vouchers.recipient_username IS 'Username of the user who received/will receive this voucher';
COMMENT ON COLUMN public.vouchers.recipient_email IS 'Email of the user who received/will receive this voucher';