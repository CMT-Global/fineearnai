-- Phase 1: Add IP tracking columns to profiles table for IPStack integration
-- This enables country and IP detection during registration and login

-- Add new columns for IP and location tracking
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS registration_ip TEXT,
ADD COLUMN IF NOT EXISTS registration_country TEXT,
ADD COLUMN IF NOT EXISTS registration_country_name TEXT,
ADD COLUMN IF NOT EXISTS last_login_ip TEXT,
ADD COLUMN IF NOT EXISTS last_login_country TEXT,
ADD COLUMN IF NOT EXISTS last_login_country_name TEXT;

-- Create indexes for faster country-based queries (admin filtering)
CREATE INDEX IF NOT EXISTS idx_profiles_registration_country ON public.profiles(registration_country);
CREATE INDEX IF NOT EXISTS idx_profiles_last_login_country ON public.profiles(last_login_country);

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.registration_ip IS 'IP address used during account registration';
COMMENT ON COLUMN public.profiles.registration_country IS 'ISO 3166-1 alpha-2 country code at registration';
COMMENT ON COLUMN public.profiles.registration_country_name IS 'Full country name at registration';
COMMENT ON COLUMN public.profiles.last_login_ip IS 'Most recent login IP address';
COMMENT ON COLUMN public.profiles.last_login_country IS 'ISO 3166-1 alpha-2 country code at last login';
COMMENT ON COLUMN public.profiles.last_login_country_name IS 'Full country name at last login';