-- Phase 1: Custom Password Reset System - Database Schema
-- Create password_reset_tokens table for secure token storage

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text
);

-- Create indexes for fast token lookup and queries
CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON public.password_reset_tokens(expires_at);

-- Enable Row Level Security
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only service role can manage tokens (backend edge functions)
DROP POLICY IF EXISTS "Service role can manage tokens" ON public.password_reset_tokens;
CREATE POLICY "Service role can manage tokens"
  ON public.password_reset_tokens
  FOR ALL
  TO service_role
  USING (true);

-- Cleanup function for expired tokens (will be called by daily cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_password_reset_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.password_reset_tokens
  WHERE expires_at < now() - interval '24 hours';
  
  RAISE NOTICE 'Cleaned up expired password reset tokens at %', now();
END;
$$;

-- Add helpful comment
COMMENT ON TABLE public.password_reset_tokens IS 'Stores secure tokens for custom password reset flow. Tokens expire in 1 hour and are single-use only.';
COMMENT ON FUNCTION cleanup_expired_password_reset_tokens() IS 'Removes expired password reset tokens older than 24 hours. Should be called daily via cron job.';