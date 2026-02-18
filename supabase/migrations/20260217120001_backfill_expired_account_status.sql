-- Backfill: set account_status = 'expired' for users whose plan is already expired.
-- Only for currently active users (do not override suspended/banned).
-- Runs in a separate migration so the new enum value from 20260217120000 is committed first.
UPDATE public.profiles
SET account_status = 'expired'
WHERE plan_expires_at IS NOT NULL
  AND plan_expires_at < NOW()
  AND account_status = 'active';
