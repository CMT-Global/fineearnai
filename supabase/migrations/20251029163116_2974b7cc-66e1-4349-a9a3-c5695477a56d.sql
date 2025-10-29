-- ============================================================================
-- PHASE 3.3: DROP DATABASE OBJECTS (Cron jobs handled separately)
-- ============================================================================

-- Drop view first
DROP VIEW IF EXISTS public.commission_queue_health CASCADE;

-- Drop function
DROP FUNCTION IF EXISTS public.process_commission_atomic CASCADE;

-- Drop table last
DROP TABLE IF EXISTS public.commission_queue CASCADE;

-- Verification
SELECT 
  'commission_queue table' as object_type,
  NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'commission_queue'
  ) as successfully_removed
UNION ALL
SELECT 
  'process_commission_atomic function' as object_type,
  NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'process_commission_atomic'
  ) as successfully_removed
UNION ALL
SELECT 
  'commission_queue_health view' as object_type,
  NOT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'commission_queue_health'
  ) as successfully_removed;