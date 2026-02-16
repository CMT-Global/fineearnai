-- Rename the free-tier plan from 'free' to 'Trainee' in membership_plans table.
-- This fixes the issue where new users were assigned 'free' as their membership_plan
-- because the original seed data created a plan with name='free' and account_type='free'.
-- The code correctly queries by account_type='free' but returns the plan name, which was 'free'.

-- Step 1: Rename the plan in membership_plans table
-- Only update if the plan named 'free' exists and no 'Trainee' plan exists yet
UPDATE public.membership_plans
SET 
  name = 'Trainee',
  display_name = 'Trainee Plan'
WHERE account_type = 'free' 
  AND name = 'free'
  AND NOT EXISTS (SELECT 1 FROM public.membership_plans WHERE name = 'Trainee');

-- Step 2: Backfill existing profiles that have membership_plan = 'free' to 'Trainee'
UPDATE public.profiles
SET membership_plan = 'Trainee'
WHERE LOWER(TRIM(COALESCE(membership_plan, ''))) = 'free';

-- Step 3: Update the column default to 'Trainee' (in case it was set to 'free')
ALTER TABLE public.profiles
  ALTER COLUMN membership_plan SET DEFAULT 'Trainee';
