-- Create account_deletion_otps table
CREATE TABLE IF NOT EXISTS public.account_deletion_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  ip_address TEXT,
  user_agent TEXT
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_account_deletion_otps_user_id ON public.account_deletion_otps(user_id);
CREATE INDEX IF NOT EXISTS idx_account_deletion_otps_otp_code ON public.account_deletion_otps(otp_code);
CREATE INDEX IF NOT EXISTS idx_account_deletion_otps_expires_at ON public.account_deletion_otps(expires_at);

-- Enable RLS
ALTER TABLE public.account_deletion_otps ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role manages OTPs (same as email_verification_otps)
DROP POLICY IF EXISTS "Service role manages OTPs" ON public.account_deletion_otps;
CREATE POLICY "Service role manages OTPs"
ON public.account_deletion_otps
FOR ALL
USING (true);

-- Add comment
COMMENT ON TABLE public.account_deletion_otps IS 'Stores OTP codes for account deletion verification';

-- Create cleanup function for expired OTPs (similar to email verification)
CREATE OR REPLACE FUNCTION public.cleanup_expired_account_deletion_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.account_deletion_otps
  WHERE expires_at < NOW() - INTERVAL '24 hours';
  
  RAISE NOTICE 'Cleaned up expired account deletion OTPs at %', NOW();
END;
$$;