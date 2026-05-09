-- Migration: Public Withdrawals History feature
-- Adds: public_pages platform_config key, public RLS policy, composite index

-- 1. Insert default platform config for public pages (disabled by default)
INSERT INTO public.platform_config (key, value, description)
VALUES (
  'public_pages',
  '{"withdrawalsHistoryEnabled": false}'::jsonb,
  'Controls visibility of public-facing pages like the Withdrawals History page'
)
ON CONFLICT (key) DO NOTHING;

-- 2. Add a composite index for fast public queries (status + processed_at DESC)
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status_processed_at
  ON public.withdrawal_requests (status, processed_at DESC);

-- 3. Add public RLS policy for completed withdrawals
--    Only returns rows when:
--    a) status = 'completed'
--    b) platform_config key 'public_pages' has withdrawalsHistoryEnabled = true
--    This is self-enforcing at the DB layer - disabling the toggle instantly blocks all anon access.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'withdrawal_requests'
      AND policyname = 'Public can view completed withdrawals when enabled'
  ) THEN
    CREATE POLICY "Public can view completed withdrawals when enabled"
      ON public.withdrawal_requests
      FOR SELECT
      TO anon, authenticated
      USING (
        status = 'completed'
        AND EXISTS (
          SELECT 1
          FROM public.platform_config
          WHERE key = 'public_pages'
            AND (value->>'withdrawalsHistoryEnabled')::boolean = true
        )
      );
  END IF;
END $$;
