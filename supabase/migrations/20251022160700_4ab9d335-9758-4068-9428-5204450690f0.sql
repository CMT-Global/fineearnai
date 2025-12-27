-- ============================================
-- PHASE 2: Daily Cleanup of Pending Transactions
-- ============================================
-- This migration sets up automated cleanup of old pending deposit transactions
-- Runs daily at 3:00 AM UTC to remove transactions older than 24 hours

-- Enable required extensions for CRON scheduling (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    CREATE EXTENSION pg_cron;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
  ) THEN
    CREATE EXTENSION pg_net;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Create a monitoring view for pending transactions health
CREATE OR REPLACE VIEW public.pending_transactions_health AS
SELECT 
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') as pending_last_hour,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as pending_last_24h,
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '24 hours') as stale_pending,
  COUNT(*) as total_pending,
  MIN(created_at) as oldest_pending,
  MAX(created_at) as newest_pending,
  SUM(amount) as total_pending_amount
FROM public.transactions
WHERE type = 'deposit' 
  AND status = 'pending';

COMMENT ON VIEW public.pending_transactions_health IS 
'Monitoring view for pending transaction cleanup system. Shows counts and health metrics.';

-- Schedule the cleanup function to run daily at 3:00 AM UTC (idempotent)
-- Using pg_cron to invoke the Edge Function via pg_net
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-pending-transactions-daily');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
  'cleanup-pending-transactions-daily',
  '0 3 * * *', -- Every day at 3:00 AM UTC
  $$
  SELECT
    net.http_post(
      url := 'https://mobikymhzchzakwzpqep.supabase.co/functions/v1/cleanup-pending-transactions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vYmlreW1oemNoemFrd3pwcWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NTIzODcsImV4cCI6MjA3NTQyODM4N30.XWSL-ZIzX2DRp5lO7lYnj7L3Cns2z2g3OGdtb8JhDRc'
      ),
      body := jsonb_build_object(
        'scheduled_at', NOW(),
        'triggered_by', 'pg_cron'
      )
    ) as request_id;
  $$
);

-- Create an index to optimize the cleanup query
CREATE INDEX IF NOT EXISTS idx_transactions_pending_cleanup 
ON public.transactions (created_at, type, status) 
WHERE type = 'deposit' AND status = 'pending';

COMMENT ON INDEX public.idx_transactions_pending_cleanup IS 
'Optimizes daily cleanup query for old pending deposit transactions';

-- Log the CRON job setup
DO $$
BEGIN
  RAISE NOTICE '✅ CRON job "cleanup-pending-transactions-daily" scheduled successfully';
  RAISE NOTICE '⏰ Runs daily at 3:00 AM UTC';
  RAISE NOTICE '🧹 Deletes pending deposit transactions older than 24 hours';
  RAISE NOTICE '📊 Monitor health via: SELECT * FROM pending_transactions_health;';
END $$;