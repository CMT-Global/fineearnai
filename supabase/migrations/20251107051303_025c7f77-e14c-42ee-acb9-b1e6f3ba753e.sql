-- PHASE 5 FIX: Add exponential backoff for retry delays
-- Prevents immediate retries that could overload system resources

-- Add next_retry_at column to track when job can be retried
ALTER TABLE public.bulk_email_jobs 
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ DEFAULT NULL;

-- Add index for efficient retry scheduling queries
CREATE INDEX IF NOT EXISTS idx_bulk_email_jobs_retry_schedule 
ON public.bulk_email_jobs(status, next_retry_at) 
WHERE status = 'queued' AND next_retry_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.bulk_email_jobs.next_retry_at IS 'Timestamp when job can be retried (uses exponential backoff: 2^retry_count minutes). NULL means can retry immediately.';

-- Drop existing function first (required to change return type)
DROP FUNCTION IF EXISTS public.get_next_bulk_email_job();

-- Recreate function with next_retry_at in return type
CREATE OR REPLACE FUNCTION public.get_next_bulk_email_job()
RETURNS TABLE (
  id UUID,
  batch_id TEXT,
  subject TEXT,
  body TEXT,
  recipient_filter JSONB,
  total_recipients INTEGER,
  processed_count INTEGER,
  successful_count INTEGER,
  failed_count INTEGER,
  status TEXT,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_processed_at TIMESTAMPTZ,
  estimated_completion_at TIMESTAMPTZ,
  created_by UUID,
  error_message TEXT,
  processing_metadata JSONB,
  last_heartbeat TIMESTAMPTZ,
  processing_worker_id TEXT,
  duplicate_check_hash TEXT,
  cancel_requested BOOLEAN,
  retry_count INTEGER,
  max_retries INTEGER,
  next_retry_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id, j.batch_id, j.subject, j.body, j.recipient_filter,
    j.total_recipients, j.processed_count, j.successful_count,
    j.failed_count, j.status, j.created_at, j.started_at,
    j.completed_at, j.last_processed_at, j.estimated_completion_at,
    j.created_by, j.error_message, j.processing_metadata,
    j.last_heartbeat, j.processing_worker_id, j.duplicate_check_hash,
    j.cancel_requested, j.retry_count, j.max_retries, j.next_retry_at
  FROM bulk_email_jobs j
  WHERE j.status IN ('queued', 'processing')
    AND (j.cancel_requested = FALSE OR j.cancel_requested IS NULL)
    AND (j.last_heartbeat IS NULL OR j.last_heartbeat < NOW() - INTERVAL '10 minutes')
    AND (j.next_retry_at IS NULL OR j.next_retry_at <= NOW())
  ORDER BY j.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
END;
$$;