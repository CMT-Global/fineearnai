-- Backfill: set profiles with membership_plan = 'free', NULL, or blank to the current free-tier plan name.
-- Uses account_type = 'free' as source of truth so it works whether that plan is named 'free' or 'Trainee'.
-- Idempotent and safe to re-run.

UPDATE public.profiles p
SET membership_plan = mp.name
FROM (
  SELECT name
  FROM public.membership_plans
  WHERE account_type = 'free'
    AND is_active = true
  LIMIT 1
) mp
WHERE (
  LOWER(TRIM(COALESCE(p.membership_plan, ''))) = 'free'
  OR p.membership_plan IS NULL
  OR TRIM(COALESCE(p.membership_plan, '')) = ''
);
