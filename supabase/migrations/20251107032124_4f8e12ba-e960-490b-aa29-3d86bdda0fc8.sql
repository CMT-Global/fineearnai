-- Phase 1: Fix processed_count tracking with database trigger
-- This ensures counts are always accurate even if the job is interrupted

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS sync_job_counts_on_email_log ON email_logs;
DROP FUNCTION IF EXISTS sync_bulk_email_job_counts();

-- Create function to auto-calculate processed_count from email_logs
CREATE OR REPLACE FUNCTION sync_bulk_email_job_counts()
RETURNS TRIGGER AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- Extract job_id from metadata
  v_job_id := (NEW.metadata->>'job_id')::uuid;
  
  -- Skip if no job_id in metadata
  IF v_job_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Update job counts based on actual email_logs
  UPDATE bulk_email_jobs
  SET 
    processed_count = (
      SELECT COUNT(*) 
      FROM email_logs 
      WHERE (metadata->>'job_id')::uuid = v_job_id
    ),
    successful_count = (
      SELECT COUNT(*) 
      FROM email_logs 
      WHERE (metadata->>'job_id')::uuid = v_job_id 
      AND status = 'sent'
    ),
    failed_count = (
      SELECT COUNT(*) 
      FROM email_logs 
      WHERE (metadata->>'job_id')::uuid = v_job_id 
      AND status = 'failed'
    ),
    last_processed_at = NOW()
  WHERE id = v_job_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-sync counts after each email log insert
CREATE TRIGGER sync_job_counts_on_email_log
AFTER INSERT ON email_logs
FOR EACH ROW
EXECUTE FUNCTION sync_bulk_email_job_counts();

-- Backfill existing jobs with correct counts
UPDATE bulk_email_jobs
SET 
  processed_count = COALESCE((
    SELECT COUNT(*) 
    FROM email_logs 
    WHERE (metadata->>'job_id')::uuid = bulk_email_jobs.id
  ), 0),
  successful_count = COALESCE((
    SELECT COUNT(*) 
    FROM email_logs 
    WHERE (metadata->>'job_id')::uuid = bulk_email_jobs.id 
    AND status = 'sent'
  ), 0),
  failed_count = COALESCE((
    SELECT COUNT(*) 
    FROM email_logs 
    WHERE (metadata->>'job_id')::uuid = bulk_email_jobs.id 
    AND status = 'failed'
  ), 0)
WHERE status IN ('processing', 'completed', 'failed', 'cancelled');

-- Add comment for documentation
COMMENT ON FUNCTION sync_bulk_email_job_counts() IS 
  'Auto-syncs bulk_email_jobs counts from email_logs. Ensures counts are always accurate even if job is interrupted.';
