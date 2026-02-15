# Free Plan Issue - Root Cause & Fix

## Problem Summary

Users with the "free" plan (now renamed to "Trainee") cannot access tasks or perform platform actions. This is blocking the entire platform functionality for default tier users.

## Root Cause

When you renamed the plan from 'free' to 'Trainee' in the database, **several database functions and triggers were still hardcoded to query for `name = 'free'`** instead of using `account_type = 'free'`.

### What Should Happen:
- The `account_type = 'free'` field is the **source of truth** for identifying the default/free tier plan
- The `name` field can be anything (e.g., "Trainee", "Free", "Basic")
- Code should query by `account_type = 'free'`, not by `name = 'free'`

### What Was Happening:
- Database functions like `handle_new_user()` were querying `WHERE name = 'free'`
- After renaming the plan to 'Trainee', these queries returned NULL
- New users got NULL as their plan, existing users couldn't access tasks
- Task access functions failed because they couldn't find a valid plan

## Affected Database Functions

1. **`handle_new_user()`** - Line 87 in `20260129200000_profile_wizard_and_completion.sql`
   ```sql
   -- WRONG:
   SELECT free_plan_expiry_days FROM membership_plans WHERE name = 'free'

   -- CORRECT:
   SELECT free_plan_expiry_days FROM membership_plans WHERE account_type = 'free' AND is_active = true
   ```

2. **`handle_profile_wizard_completion()`** - Hardcoded 'free' plan lookup
3. **`recalculate_free_plan_expiries()`** - Two versions, both checking `membership_plan = 'free'`

## Files Changed

### 1. Migration File (Main Fix)
**`supabase/migrations/20260217000000_fix_hardcoded_free_plan_name_references.sql`**

This migration updates all database functions to:
- Query by `account_type = 'free'` instead of `name = 'free'`
- Get the actual plan name dynamically from the database
- Use that name when setting `membership_plan` on profiles

### 2. Verification Script
**`verify_and_fix_free_plan.sql`**

Use this in Supabase SQL Editor to:
- Check if the issue exists
- See how many users are affected
- Verify the fix worked

## How to Apply the Fix

### Step 1: Run the Verification Script (Optional but Recommended)
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `verify_and_fix_free_plan.sql`
3. Run it to see the current state
4. Note how many users have `membership_plan='free'` or NULL

### Step 2: Apply the Migration
```bash
# Apply the migration to your database
supabase db push

# Or if using Supabase CLI:
supabase migration up
```

### Step 3: Verify the Fix
Run the verification script again to confirm:
- Database functions are updated
- All profiles have valid plan names
- Users can access tasks

### Step 4: Manual Data Cleanup (if needed)
If some profiles still have `membership_plan='free'` or NULL, run this in Supabase SQL Editor:

```sql
-- Update profiles with the correct plan name
UPDATE profiles
SET membership_plan = (
  SELECT name FROM membership_plans
  WHERE account_type = 'free' AND is_active = true
  LIMIT 1
)
WHERE COALESCE(TRIM(membership_plan), '') = ''
   OR LOWER(TRIM(COALESCE(membership_plan, ''))) = 'free';
```

## Prevention for Future

### ✅ DO:
- Always use `account_type` to identify plan tiers
- Query: `WHERE account_type = 'free'` (for default tier)
- Let the `name` field be flexible and user-facing

### ❌ DON'T:
- Hardcode plan names like `WHERE name = 'free'`
- Assume the plan name will never change
- Use string comparisons on the `name` field in business logic

## Code References to Check

These parts of the codebase correctly use `account_type`:

✅ **Frontend:**
- `src/lib/plan-utils.ts:19` - `isFreeTierPlan()` correctly checks `account_type === 'free'`
- `src/pages/MembershipPlans.tsx` - Uses `account_type === 'free'` for identification

✅ **Backend Edge Functions:**
- `supabase/functions/get-next-task/index.ts:86` - Correctly queries by `account_type = 'free'`
- `supabase/functions/complete-ai-task/index.ts:123` - Correctly uses `account_type = 'free'`
- `supabase/functions/_shared/cache.ts:87` - Fallback uses `account_type = 'free'`

## Testing After Fix

1. **New User Signup:**
   - Create a new account
   - Complete profile wizard
   - Check if `membership_plan` is set to 'Trainee' (or your default plan name)
   - Verify user can access tasks

2. **Existing Users:**
   - Log in as an existing user
   - Check if they can fetch and complete tasks
   - Verify plan expiry dates are correct

3. **Admin Panel:**
   - Go to Admin → Plans Management
   - Update the default plan's `free_plan_expiry_days`
   - Verify it recalculates expiry for all users on that plan

## Support

If issues persist after applying this fix:
1. Check Supabase logs for function errors
2. Run the verification script to see current state
3. Check if migration was applied: `SELECT * FROM _migrations WHERE name LIKE '%20260217%'`
4. Verify the plan exists: `SELECT * FROM membership_plans WHERE account_type = 'free'`

---

**Migration Created:** 2025-02-17
**Issue Type:** Database function hardcoded plan name references
**Severity:** Critical - Blocking user access to core functionality
**Status:** Fixed with migration `20260217000000_fix_hardcoded_free_plan_name_references.sql`
