
-- Phase 1.3: Add locking columns and safe job selection function for bulk email queue

-- Step 1: Add columns for job locking and duplicate detection
ALTER TABLE bulk_email_jobs 
  ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_worker_id TEXT,
  ADD COLUMN IF NOT EXISTS duplicate_check_hash TEXT,
  ADD COLUMN IF NOT EXISTS cancel_requested BOOLEAN DEFAULT FALSE;

-- Step 2: Create index for fast stuck job detection
CREATE INDEX IF NOT EXISTS idx_bulk_email_jobs_stuck 
  ON bulk_email_jobs(status, last_heartbeat)
  WHERE status = 'processing';

-- Step 3: Create index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_bulk_email_jobs_duplicate 
  ON bulk_email_jobs(duplicate_check_hash, created_at)
  WHERE status IN ('queued', 'processing');

-- Step 4: Create function to safely fetch next job with locking
CREATE OR REPLACE FUNCTION get_next_bulk_email_job()
RETURNS TABLE(
  id uuid,
  batch_id text,
  subject text,
  body text,
  recipient_filter jsonb,
  total_recipients integer,
  processed_count integer,
  successful_count integer,
  failed_count integer,
  status text,
  created_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  last_processed_at timestamptz,
  estimated_completion_at timestamptz,
  created_by uuid,
  error_message text,
  processing_metadata jsonb,
  last_heartbeat timestamptz,
  processing_worker_id text,
  duplicate_check_hash text,
  cancel_requested boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
    j.cancel_requested
  FROM bulk_email_jobs j
  WHERE j.status IN ('queued', 'processing')
    AND (j.cancel_requested = FALSE OR j.cancel_requested IS NULL)
    AND (j.last_heartbeat IS NULL OR j.last_heartbeat < NOW() - INTERVAL '10 minutes')
  ORDER BY j.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
END;
$$;

-- Step 5: Grant execute permission to service role
GRANT EXECUTE ON FUNCTION get_next_bulk_email_job() TO service_role;

-- Step 6: Add comment for documentation
COMMENT ON FUNCTION get_next_bulk_email_job() IS 
  'Safely fetches the next bulk email job to process with row-level locking to prevent race conditions. Returns NULL if no jobs available.';

COMMENT ON COLUMN bulk_email_jobs.last_heartbeat IS 
  'Timestamp of last worker heartbeat - used to detect stuck jobs (jobs stuck for >10 minutes are reset)';

COMMENT ON COLUMN bulk_email_jobs.processing_worker_id IS 
  'Unique identifier of the worker processing this job - used for debugging and monitoring';

COMMENT ON COLUMN bulk_email_jobs.duplicate_check_hash IS 
  'Hash of subject+recipient_filter for detecting duplicate job submissions within 5 minutes';

COMMENT ON COLUMN bulk_email_jobs.cancel_requested IS 
  'Flag set by admin to request graceful cancellation of job after current batch completes';
