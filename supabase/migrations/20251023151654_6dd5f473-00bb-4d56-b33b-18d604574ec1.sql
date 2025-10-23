-- Phase 1: Database Cleanup - Remove obsolete payout_days and add performance index

-- 1. Delete obsolete payout_days configuration (replaced by payout_schedule)
DELETE FROM public.platform_config WHERE key = 'payout_days';

-- 2. Add performance index for withdrawal requests status filtering
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status 
ON public.withdrawal_requests(status);

-- 3. Add comment for documentation
COMMENT ON INDEX idx_withdrawal_requests_status IS 'Performance index for filtering withdrawal requests by status in admin panel';