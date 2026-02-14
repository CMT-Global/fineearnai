-- Fix plan assignment: Trainee = users who never purchased a plan; others = from subscription (plan_upgrade).
-- Corrects the earlier backfill that wrongly set free users to Beginner.
-- Requires: membership_plans has a plan named 'Trainee' (free tier).
-- Run once; safe to re-run (idempotent for correct data).

-- Step 1: Users who HAVE purchased (have at least one completed plan_upgrade): set membership_plan
--         to the plan name from their LATEST plan_upgrade transaction (subscription = source of truth).
WITH latest_upgrade AS (
  SELECT DISTINCT ON (t.user_id)
    t.user_id,
    COALESCE(
      NULLIF(TRIM(t.metadata->>'new_plan'), ''),
      TRIM(REGEXP_REPLACE(t.description, '^Upgraded to (.+) plan$', '\1', 'i'))
    ) AS plan_name
  FROM public.transactions t
  WHERE t.type = 'plan_upgrade'
    AND t.status = 'completed'
  ORDER BY t.user_id, t.created_at DESC
)
UPDATE public.profiles p
SET membership_plan = lu.plan_name
FROM latest_upgrade lu
WHERE p.id = lu.user_id
  AND lu.plan_name IS NOT NULL
  AND lu.plan_name <> ''
  AND EXISTS (
    SELECT 1 FROM public.membership_plans mp
    WHERE mp.name = lu.plan_name
    LIMIT 1
  );

-- Step 2: Users who have NEVER purchased (no plan_upgrade): set to Trainee (free tier).
UPDATE public.profiles p
SET membership_plan = 'Trainee'
WHERE NOT EXISTS (
  SELECT 1 FROM public.transactions t
  WHERE t.user_id = p.id
    AND t.type = 'plan_upgrade'
    AND t.status = 'completed'
)
AND EXISTS (SELECT 1 FROM public.membership_plans WHERE name = 'Trainee' LIMIT 1);
