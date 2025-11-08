-- Create table for withdrawal address OTPs
CREATE TABLE IF NOT EXISTS withdrawal_address_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  usdc_address TEXT,
  usdt_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  ip_address TEXT,
  user_agent TEXT
);

-- Add RLS policies
ALTER TABLE withdrawal_address_otps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages withdrawal address OTPs"
ON withdrawal_address_otps
FOR ALL
USING (true);

-- Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_withdrawal_otps_lookup 
ON withdrawal_address_otps(user_id, otp_code, expires_at);

CREATE INDEX IF NOT EXISTS idx_withdrawal_otps_cleanup 
ON withdrawal_address_otps(expires_at, used_at);

-- Add comment for documentation
COMMENT ON TABLE withdrawal_address_otps IS 'Stores one-time passwords for verifying cryptocurrency withdrawal address changes';
COMMENT ON COLUMN withdrawal_address_otps.otp_code IS '6-digit verification code sent via email';
COMMENT ON COLUMN withdrawal_address_otps.expires_at IS 'OTP expiry time (typically 10 minutes from creation)';
COMMENT ON COLUMN withdrawal_address_otps.attempts IS 'Number of verification attempts made';
COMMENT ON COLUMN withdrawal_address_otps.max_attempts IS 'Maximum allowed verification attempts before OTP is invalidated';