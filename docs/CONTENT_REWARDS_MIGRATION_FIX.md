# Content Rewards Migration Fix

## Problem
Getting 404 error when trying to enable Content Rewards:
```
POST /rest/v1/rpc/admin_enable_content_rewards 404 (Not Found)
```

This means the database migrations haven't been run yet.

## Solution: Run Database Migrations

The migrations exist in `supabase/migrations/` but need to be applied to your database.

### Option 1: Using Supabase CLI (Recommended)

1. **Check if you have Supabase CLI installed:**
   ```bash
   supabase --version
   ```

2. **Link to your project (if not already linked):**
   ```bash
   supabase link --project-ref your-project-ref
   ```

3. **Run migrations:**
   ```bash
   supabase db push
   ```

   Or apply specific migrations:
   ```bash
   supabase migration up
   ```

### Option 2: Using Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Run each migration file in order:

   **Migration 1:** `20260205142000_add_content_rewards_fields.sql`
   ```sql
   ALTER TABLE public.profiles
   ADD COLUMN IF NOT EXISTS content_rewards_enabled BOOLEAN NOT NULL DEFAULT FALSE,
   ADD COLUMN IF NOT EXISTS content_rewards_onboarded_at TIMESTAMP WITH TIME ZONE,
   ADD COLUMN IF NOT EXISTS content_rewards_status TEXT NOT NULL DEFAULT 'pending' 
     CHECK (content_rewards_status IN ('pending', 'approved', 'suspended'));
   ```

   **Migration 2:** `20260205142001_create_referral_clicks_table.sql`
   - Copy the entire contents of this file and run it

   **Migration 3:** `20260205142002_create_content_rewards_admin_functions.sql`
   - Copy the entire contents of this file and run it
   - This creates the RPC functions that are failing

   **Migration 4:** `20260205142003_seed_content_rewards_config.sql`
   - Copy the entire contents of this file and run it

### Option 3: Manual SQL Execution

If you have direct database access, you can run the migrations manually:

1. **Add profile columns:**
   ```sql
   ALTER TABLE public.profiles
   ADD COLUMN IF NOT EXISTS content_rewards_enabled BOOLEAN NOT NULL DEFAULT FALSE,
   ADD COLUMN IF NOT EXISTS content_rewards_onboarded_at TIMESTAMP WITH TIME ZONE,
   ADD COLUMN IF NOT EXISTS content_rewards_status TEXT NOT NULL DEFAULT 'pending' 
     CHECK (content_rewards_status IN ('pending', 'approved', 'suspended'));
   ```

2. **Create referral_clicks table:**
   - See `supabase/migrations/20260205142001_create_referral_clicks_table.sql`

3. **Create admin functions:**
   - See `supabase/migrations/20260205142002_create_content_rewards_admin_functions.sql`
   - This is the critical one that fixes the 404 error

4. **Seed configuration:**
   - See `supabase/migrations/20260205142003_seed_content_rewards_config.sql`

## Verify Migrations Were Applied

After running migrations, verify:

1. **Check if columns exist:**
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'profiles' 
   AND column_name LIKE 'content_rewards%';
   ```

2. **Check if RPC functions exist:**
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name LIKE '%content_rewards%';
   ```

   Should return:
   - `admin_enable_content_rewards`
   - `admin_disable_content_rewards`
   - `admin_suspend_content_rewards`
   - `get_content_rewards_stats`

3. **Test the function:**
   ```sql
   SELECT admin_enable_content_rewards('some-user-id-here');
   ```

## After Running Migrations

1. **Refresh your browser** - Clear cache if needed
2. **Try enabling Content Rewards again** - The 404 error should be gone
3. **Check browser console** - Should see success messages instead of errors

## Toast Error Fix

The `toast.error is not a function` error should also be fixed once the RPC function exists, as the error handling will work properly. The toast methods (`toast.error()` and `toast.success()`) are correct and used throughout the codebase.

## Still Having Issues?

If you still get errors after running migrations:

1. **Check RLS policies** - Make sure admin users have access
2. **Check function permissions** - Functions should be `SECURITY DEFINER`
3. **Check browser console** - Look for any other errors
4. **Verify admin role** - Make sure your user has `admin` role in `user_roles` table
