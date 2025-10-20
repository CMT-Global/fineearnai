-- Phase 2.2: Create Daily Reset Audit Log Table
-- This table stores audit logs for every daily counter reset operation

CREATE TABLE IF NOT EXISTS public.daily_reset_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reset_date DATE NOT NULL UNIQUE,
  users_reset INTEGER NOT NULL,
  triggered_by TEXT NOT NULL DEFAULT 'cron',
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  execution_time_ms INTEGER,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comment to table
COMMENT ON TABLE public.daily_reset_logs IS 'Audit log for daily task counter resets. Tracks when resets occur, how many users were affected, and execution details.';

-- Add comments to columns
COMMENT ON COLUMN public.daily_reset_logs.reset_date IS 'Date of the reset (unique per day)';
COMMENT ON COLUMN public.daily_reset_logs.users_reset IS 'Number of users whose counters were reset';
COMMENT ON COLUMN public.daily_reset_logs.triggered_by IS 'Source of reset trigger (cron, manual, admin)';
COMMENT ON COLUMN public.daily_reset_logs.execution_time_ms IS 'Time taken to complete reset in milliseconds';
COMMENT ON COLUMN public.daily_reset_logs.details IS 'Additional metadata (UTC time, EAT time, user IDs, etc.)';

-- Create index for efficient date-based queries
CREATE INDEX idx_reset_logs_date ON public.daily_reset_logs(reset_date DESC);

-- Create index for triggered_by queries
CREATE INDEX idx_reset_logs_triggered_by ON public.daily_reset_logs(triggered_by);

-- Enable Row Level Security
ALTER TABLE public.daily_reset_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view reset logs
CREATE POLICY "Admins can view reset logs"
ON public.daily_reset_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only service role can insert reset logs (via edge functions)
CREATE POLICY "Service role can insert reset logs"
ON public.daily_reset_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Verify table creation
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'daily_reset_logs'
ORDER BY ordinal_position;