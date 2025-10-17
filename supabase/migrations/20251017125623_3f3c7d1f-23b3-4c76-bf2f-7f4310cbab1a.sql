-- ============================================
-- PHASE 3: ADD ESSENTIAL INDEXES FOR PERFORMANCE
-- Create indexes on profiles and referrals tables to optimize direct queries
-- These ensure fast search, filtering, sorting, and pagination
-- ============================================

-- Full-text search index for username, email, and full_name
CREATE INDEX IF NOT EXISTS idx_profiles_search 
ON public.profiles USING gin(
  to_tsvector('english', 
    COALESCE(username, '') || ' ' || 
    COALESCE(email, '') || ' ' || 
    COALESCE(full_name, '')
  )
);

-- Index for filtering by membership plan
CREATE INDEX IF NOT EXISTS idx_profiles_membership_plan 
ON public.profiles(membership_plan);

-- Index for filtering by account status
CREATE INDEX IF NOT EXISTS idx_profiles_account_status 
ON public.profiles(account_status);

-- Index for filtering by country (partial index - only non-null values)
CREATE INDEX IF NOT EXISTS idx_profiles_country 
ON public.profiles(country) 
WHERE country IS NOT NULL;

-- Index for sorting by created_at (most common sort)
CREATE INDEX IF NOT EXISTS idx_profiles_created_at_desc 
ON public.profiles(created_at DESC);

-- Index for sorting by last_login
CREATE INDEX IF NOT EXISTS idx_profiles_last_login_desc 
ON public.profiles(last_login DESC NULLS LAST);

-- Index for sorting by total_earned
CREATE INDEX IF NOT EXISTS idx_profiles_total_earned_desc 
ON public.profiles(total_earned DESC);

-- Index for referral counts (used in stats aggregation)
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id 
ON public.referrals(referrer_id);

-- Index for referral status filtering
CREATE INDEX IF NOT EXISTS idx_referrals_status 
ON public.referrals(status);

-- Composite index for referral lookups (referrer + status)
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_status 
ON public.referrals(referrer_id, status);

-- Add comments for documentation
COMMENT ON INDEX public.idx_profiles_search IS 
'Full-text search index for fast user search by username, email, or full name';

COMMENT ON INDEX public.idx_profiles_membership_plan IS 
'Index for filtering users by membership plan in admin panel';

COMMENT ON INDEX public.idx_profiles_account_status IS 
'Index for filtering users by account status (active, suspended, banned)';

COMMENT ON INDEX public.idx_profiles_country IS 
'Partial index for country filtering - only indexes non-null values';

COMMENT ON INDEX public.idx_profiles_created_at_desc IS 
'Index for sorting users by registration date (newest first)';

COMMENT ON INDEX public.idx_referrals_referrer_id IS 
'Index for aggregating referral counts per user';

-- Analyze tables to update statistics for query planner
ANALYZE public.profiles;
ANALYZE public.referrals;