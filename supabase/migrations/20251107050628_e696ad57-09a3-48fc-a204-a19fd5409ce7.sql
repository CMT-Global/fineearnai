-- PHASE 5 FIX: Add retry limit tracking to bulk_email_jobs
-- Prevents infinite retries on permanently failed jobs

-- Add retry tracking columns
ALTER TABLE public.bulk_email_jobs 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3 NOT NULL;

-- Add index for monitoring queries
CREATE INDEX IF NOT EXISTS idx_bulk_email_jobs_retry_tracking 
ON public.bulk_email_jobs(status, retry_count, max_retries) 
WHERE status IN ('queued', 'processing', 'failed');

-- Add comment for documentation
COMMENT ON COLUMN public.bulk_email_jobs.retry_count IS 'Number of times this job has been retried after failure';
COMMENT ON COLUMN public.bulk_email_jobs.max_retries IS 'Maximum number of retries allowed before marking as permanently failed (default: 3)';

-- Update existing jobs to have default values
UPDATE public.bulk_email_jobs 
SET retry_count = 0, max_retries = 3 
WHERE retry_count IS NULL OR max_retries IS NULL;