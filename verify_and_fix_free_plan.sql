-- Verification and Fix Script for 'free' Plan Issue
-- Run this in your Supabase SQL Editor to diagnose and understand the issue

-- 1. Check current state of membership_plans table
SELECT
  'Current Membership Plans' as check_name,
  id,
  name,
  account_type,
  is_active,
  daily_task_limit,
  earning_per_task,
  price
FROM membership_plans
ORDER BY price ASC;

-- 2. Check if there's a plan with name='free' (should be renamed to 'Trainee')
SELECT
  'Plans with name=free (should be 0)' as check_name,
  COUNT(*) as count
FROM membership_plans
WHERE name = 'free';

-- 3. Check if there's a plan with account_type='free' (should be 1, likely named 'Trainee')
SELECT
  'Plans with account_type=free (should be 1)' as check_name,
  COUNT(*) as count,
  STRING_AGG(name, ', ') as plan_names
FROM membership_plans
WHERE account_type = 'free' AND is_active = true;

-- 4. Check profiles with membership_plan='free' (should be updated to 'Trainee')
SELECT
  'Profiles with membership_plan=free (should be 0)' as check_name,
  COUNT(*) as count
FROM profiles
WHERE LOWER(TRIM(COALESCE(membership_plan, ''))) = 'free';

-- 5. Check profiles with NULL or empty membership_plan
SELECT
  'Profiles with NULL/empty membership_plan' as check_name,
  COUNT(*) as count
FROM profiles
WHERE COALESCE(TRIM(membership_plan), '') = '';

-- 6. Show sample of affected users (if any)
SELECT
  'Sample affected users' as check_name,
  id,
  username,
  email,
  membership_plan,
  plan_expires_at,
  account_status,
  profile_completed
FROM profiles
WHERE COALESCE(TRIM(membership_plan), '') = ''
   OR LOWER(TRIM(COALESCE(membership_plan, ''))) = 'free'
LIMIT 10;

-- FIXES (uncomment to run):

-- FIX 1: Update profiles with membership_plan='free' to use the actual plan name
-- UPDATE profiles
-- SET membership_plan = (
--   SELECT name FROM membership_plans
--   WHERE account_type = 'free' AND is_active = true
--   LIMIT 1
-- )
-- WHERE LOWER(TRIM(COALESCE(membership_plan, ''))) = 'free';

-- FIX 2: Update profiles with NULL/empty membership_plan
-- UPDATE profiles
-- SET membership_plan = (
--   SELECT name FROM membership_plans
--   WHERE account_type = 'free' AND is_active = true
--   LIMIT 1
-- )
-- WHERE COALESCE(TRIM(membership_plan), '') = '';

-- Verify the fixes worked:
-- SELECT
--   'After fix: profile membership_plan distribution' as check_name,
--   membership_plan,
--   COUNT(*) as user_count
-- FROM profiles
-- GROUP BY membership_plan
-- ORDER BY user_count DESC;
