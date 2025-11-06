-- Phase 5: Partner Debug Logs Table
-- Optional table for persistent client-side debug capture

-- Create partner_debug_logs table
CREATE TABLE IF NOT EXISTS public.partner_debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  correlation_id TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  event TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  ip_address TEXT,
  user_agent TEXT
);

-- Create index for faster queries by correlation_id and user_id
CREATE INDEX idx_partner_debug_logs_correlation_id ON public.partner_debug_logs(correlation_id);
CREATE INDEX idx_partner_debug_logs_user_id ON public.partner_debug_logs(user_id);
CREATE INDEX idx_partner_debug_logs_created_at ON public.partner_debug_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.partner_debug_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins can read, authenticated users can insert their own logs
CREATE POLICY "Admins can view all debug logs"
ON public.partner_debug_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "Users can insert their own debug logs"
ON public.partner_debug_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE public.partner_debug_logs IS 'Stores client-side debug logs for partner flow troubleshooting. Strict RLS: only admins can read, users can only insert their own logs.';

-- Optional: Add cleanup function to prevent table bloat (retain logs for 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_partner_debug_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.partner_debug_logs
  WHERE created_at < NOW() - INTERVAL '7 days';
  
  RAISE NOTICE 'Cleaned up old partner debug logs at %', NOW();
END;
$$;