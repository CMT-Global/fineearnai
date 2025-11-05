-- Create bulk_email_jobs table for asynchronous email queue processing
CREATE TABLE IF NOT EXISTS public.bulk_email_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id TEXT UNIQUE NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Progress tracking
  total_recipients INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  successful_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  
  -- Status management
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'paused', 'cancelled')),
  
  -- Timing fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_processed_at TIMESTAMPTZ,
  estimated_completion_at TIMESTAMPTZ,
  
  -- Admin tracking
  created_by UUID REFERENCES auth.users(id),
  
  -- Error handling
  error_message TEXT,
  processing_metadata JSONB DEFAULT '{}'::jsonb
);

-- Performance indexes for queue processor (fetch next queued/processing job)
CREATE INDEX IF NOT EXISTS idx_bulk_email_jobs_status_created 
  ON public.bulk_email_jobs(status, created_at) 
  WHERE status IN ('queued', 'processing');

-- Index for admin filtering and history display
CREATE INDEX IF NOT EXISTS idx_bulk_email_jobs_created_by_created 
  ON public.bulk_email_jobs(created_by, created_at DESC);

-- Index for batch_id lookups
CREATE INDEX IF NOT EXISTS idx_bulk_email_jobs_batch_id 
  ON public.bulk_email_jobs(batch_id);

-- RLS Policies for admin access
ALTER TABLE public.bulk_email_jobs ENABLE ROW LEVEL SECURITY;

-- Admins can view all bulk email jobs
CREATE POLICY "Admins can view all bulk email jobs"
  ON public.bulk_email_jobs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert bulk email jobs
CREATE POLICY "Admins can create bulk email jobs"
  ON public.bulk_email_jobs
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update bulk email jobs (for status changes, progress updates)
CREATE POLICY "Admins can update bulk email jobs"
  ON public.bulk_email_jobs
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can update jobs (for queue processor)
CREATE POLICY "Service role can update bulk email jobs"
  ON public.bulk_email_jobs
  FOR UPDATE
  USING (true);

-- Enable realtime for live progress updates in admin dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE public.bulk_email_jobs;

-- Add helpful comment
COMMENT ON TABLE public.bulk_email_jobs IS 'Stores bulk email jobs for asynchronous processing using Resend Batch API (100 emails per API call). Processes 500 recipients per cycle with real-time progress tracking.';