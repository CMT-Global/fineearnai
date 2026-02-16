-- Fix existing users who have membership_plan='free' or NULL
-- Run this in Supabase SQL Editor after applying the migration

-- Update all profiles with the correct default plan name
UPDATE profiles
SET membership_plan = (
  SELECT name FROM membership_plans
  WHERE account_type = 'free' AND is_active = true
  LIMIT 1
)
WHERE COALESCE(TRIM(membership_plan), '') = ''
   OR LOWER(TRIM(COALESCE(membership_plan, ''))) = 'free';

-- Show results
SELECT
  'Updated profiles' as status,
  COUNT(*) as affected_users
FROM profiles
WHERE membership_plan = (
  SELECT name FROM membership_plans
  WHERE account_type = 'free' AND is_active = true
  LIMIT 1
);
