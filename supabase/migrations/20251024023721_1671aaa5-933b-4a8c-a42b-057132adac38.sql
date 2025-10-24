-- Phase 6: Enhanced Logging & Monitoring for Manual Withdrawals

-- Create manual withdrawal tracking table
CREATE TABLE IF NOT EXISTS public.manual_withdrawal_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_request_id UUID NOT NULL REFERENCES public.withdrawal_requests(id) ON DELETE CASCADE,
  approved_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  processing_time_minutes INTEGER,
  admin_id UUID NOT NULL,
  blockchain_txn_hash TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_manual_withdrawal_tracking_withdrawal_id 
  ON public.manual_withdrawal_tracking(withdrawal_request_id);
CREATE INDEX IF NOT EXISTS idx_manual_withdrawal_tracking_admin_id 
  ON public.manual_withdrawal_tracking(admin_id);
CREATE INDEX IF NOT EXISTS idx_manual_withdrawal_tracking_approved_at 
  ON public.manual_withdrawal_tracking(approved_at DESC);
CREATE INDEX IF NOT EXISTS idx_manual_withdrawal_tracking_completed_at 
  ON public.manual_withdrawal_tracking(completed_at DESC);

-- RLS policies for manual withdrawal tracking
ALTER TABLE public.manual_withdrawal_tracking ENABLE ROW LEVEL SECURITY;

-- Admins can view all tracking records
CREATE POLICY "Admins can view manual withdrawal tracking"
  ON public.manual_withdrawal_tracking
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert tracking records
CREATE POLICY "Service role can insert manual withdrawal tracking"
  ON public.manual_withdrawal_tracking
  FOR INSERT
  WITH CHECK (true);

-- Service role can update tracking records
CREATE POLICY "Service role can update manual withdrawal tracking"
  ON public.manual_withdrawal_tracking
  FOR UPDATE
  USING (true);

-- Create view for manual withdrawal metrics
CREATE OR REPLACE VIEW public.manual_withdrawal_metrics AS
SELECT
  -- Current pending manual withdrawals
  (SELECT COUNT(*) 
   FROM public.withdrawal_requests 
   WHERE status = 'approved_manual') AS pending_manual_count,
  
  -- Total pending manual withdrawal amount
  (SELECT COALESCE(SUM(net_amount), 0) 
   FROM public.withdrawal_requests 
   WHERE status = 'approved_manual') AS pending_manual_amount,
  
  -- Average processing time (in minutes) for completed manual withdrawals
  (SELECT COALESCE(AVG(processing_time_minutes), 0)
   FROM public.manual_withdrawal_tracking
   WHERE completed_at IS NOT NULL
   AND processing_time_minutes IS NOT NULL) AS avg_processing_time_minutes,
  
  -- Total manual withdrawals today
  (SELECT COUNT(*)
   FROM public.manual_withdrawal_tracking
   WHERE DATE(completed_at) = CURRENT_DATE) AS completed_today,
  
  -- Total manual withdrawal volume today
  (SELECT COALESCE(SUM(wr.net_amount), 0)
   FROM public.manual_withdrawal_tracking mwt
   JOIN public.withdrawal_requests wr ON wr.id = mwt.withdrawal_request_id
   WHERE DATE(mwt.completed_at) = CURRENT_DATE) AS volume_today,
  
  -- Total manual withdrawals this week
  (SELECT COUNT(*)
   FROM public.manual_withdrawal_tracking
   WHERE completed_at >= DATE_TRUNC('week', NOW())) AS completed_this_week,
  
  -- Total manual withdrawals this month
  (SELECT COUNT(*)
   FROM public.manual_withdrawal_tracking
   WHERE completed_at >= DATE_TRUNC('month', NOW())) AS completed_this_month,
  
  -- Oldest pending manual withdrawal
  (SELECT MIN(created_at)
   FROM public.withdrawal_requests
   WHERE status = 'approved_manual') AS oldest_pending_at;

-- Grant select on view to authenticated users
GRANT SELECT ON public.manual_withdrawal_metrics TO authenticated;

COMMENT ON TABLE public.manual_withdrawal_tracking IS 'Tracks manual withdrawal processing metrics and timeline for admin monitoring';
COMMENT ON VIEW public.manual_withdrawal_metrics IS 'Aggregated metrics for manual withdrawal processing performance';