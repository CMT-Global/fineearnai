-- PHASE 2: CREATE COMMISSION AUDIT LOG TABLE
-- Track every commission attempt (success/failed) for transparency and debugging

-- Create commission_audit_log table
CREATE TABLE IF NOT EXISTS public.commission_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  referrer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  referred_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  commission_type TEXT NOT NULL CHECK (commission_type IN ('deposit', 'task')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  commission_amount NUMERIC DEFAULT 0,
  error_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_log_status 
  ON public.commission_audit_log(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_referrer 
  ON public.commission_audit_log(referrer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_created 
  ON public.commission_audit_log(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.commission_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can view all audit logs
CREATE POLICY "Admins can view audit logs" 
  ON public.commission_audit_log
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policy: Service role can insert audit logs
CREATE POLICY "Service role can insert audit logs" 
  ON public.commission_audit_log
  FOR INSERT
  WITH CHECK (true);

-- Add helpful comment
COMMENT ON TABLE public.commission_audit_log IS 'Tracks every commission processing attempt (success/failed) for deposits and tasks. Used for debugging commission failures and ensuring transparency.';
COMMENT ON COLUMN public.commission_audit_log.commission_type IS 'Type of commission: deposit or task';
COMMENT ON COLUMN public.commission_audit_log.status IS 'Outcome: success or failed';
COMMENT ON COLUMN public.commission_audit_log.error_details IS 'JSON object with error details if status is failed';