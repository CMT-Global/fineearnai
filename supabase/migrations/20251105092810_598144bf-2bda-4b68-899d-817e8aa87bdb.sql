-- Phase 1: Email Verification System - Database Schema

-- Create email_verification_otps table
CREATE TABLE IF NOT EXISTS public.email_verification_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3
);

-- Add email verification tracking to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_verification_otps_user ON public.email_verification_otps(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_otps_code ON public.email_verification_otps(otp_code);
CREATE INDEX IF NOT EXISTS idx_verification_otps_expires ON public.email_verification_otps(expires_at);

-- Enable RLS
ALTER TABLE public.email_verification_otps ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only service role (edge functions) can manage
CREATE POLICY "Service role manages OTPs" ON public.email_verification_otps
  FOR ALL 
  USING (true);

-- Cleanup function (called by cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_verification_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.email_verification_otps
  WHERE expires_at < NOW() - INTERVAL '24 hours';
  
  RAISE NOTICE 'Cleaned up expired email verification OTPs at %', NOW();
END;
$$;