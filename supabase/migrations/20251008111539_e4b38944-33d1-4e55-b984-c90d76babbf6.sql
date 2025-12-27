-- Phase 4: User Management Schema

-- Create account status enum (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
    CREATE TYPE public.account_status AS ENUM ('active', 'suspended', 'banned');
  END IF;
END $$;

-- Add account_status to profiles (idempotent)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS account_status public.account_status NOT NULL DEFAULT 'active';

-- Create audit_logs table for tracking admin actions (idempotent)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create master_login_sessions table for one-time passwords (idempotent)
CREATE TABLE IF NOT EXISTS public.master_login_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  one_time_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'audit_logs' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'master_login_sessions' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.master_login_sessions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- RLS Policies for audit_logs (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'audit_logs' 
    AND policyname = 'Admins can view all audit logs'
  ) THEN
    CREATE POLICY "Admins can view all audit logs"
    ON public.audit_logs
    FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'audit_logs' 
    AND policyname = 'Admins can insert audit logs'
  ) THEN
    CREATE POLICY "Admins can insert audit logs"
    ON public.audit_logs
    FOR INSERT
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- RLS Policies for master_login_sessions (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'master_login_sessions' 
    AND policyname = 'Admins can manage master login sessions'
  ) THEN
    CREATE POLICY "Admins can manage master login sessions"
    ON public.master_login_sessions
    FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Indexes for performance (idempotent)
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON public.audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user_id ON public.audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_master_login_sessions_token ON public.master_login_sessions(one_time_token);
CREATE INDEX IF NOT EXISTS idx_master_login_sessions_expires_at ON public.master_login_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);