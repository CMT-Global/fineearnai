# Task Duplication Prevention - Verification Guide

## Problem
Users were seeing the same task multiple times even after completing it. This violates the core requirement that **once a user submits a task, that task should never be shown to them again**.

## Root Cause Analysis

### Database Level Protection ✅
1. **Unique Constraint**: The `task_completions` table has a `UNIQUE(user_id, task_id)` constraint that prevents duplicate entries at the database level.
2. **Function-Level Check**: The `complete_task_atomic` function checks for duplicates before inserting:
   ```sql
   IF EXISTS (SELECT 1 FROM task_completions WHERE user_id = p_user_id AND task_id = p_task_id) THEN
     RETURN jsonb_build_object('success', false, 'error', 'Already completed', 'error_code', 'DUPLICATE_SUBMISSION');
   END IF;
   ```
3. **Query Exclusion**: The `get_next_task_optimized` function correctly excludes completed tasks:
   ```sql
   AND NOT EXISTS (
     SELECT 1
     FROM task_completions tc
     WHERE tc.user_id = p_user_id
     AND tc.task_id = t.id
   )
   ```

### Frontend Caching Issue ⚠️
The issue was in the React Query cache configuration:
- **Problem**: `staleTime: 10000` (10 seconds) meant cached data was considered "fresh" even after task completion
- **Problem**: After task submission, there was a delay before refetching, and cache invalidation wasn't forceful enough
- **Solution**: Changed `staleTime` to `0` to always fetch fresh data after invalidation
- **Solution**: Made cache invalidation immediate and forceful with `refetchType: 'active'`

## Changes Made

### 1. Tasks.tsx - Query Configuration
**Before:**
```typescript
staleTime: 10000,    // Cache for 10 seconds
```

**After:**
```typescript
staleTime: 0,        // Always consider data stale - fetch fresh on every request after invalidation
refetchOnWindowFocus: true, // Refetch when window regains focus to ensure fresh data
```

### 2. Tasks.tsx - Task Submission Handler
**Before:**
```typescript
queryClient.invalidateQueries({ queryKey: ['next-task', user?.id] });
setTimeout(() => {
  refetchTask();
}, 2000);
```

**After:**
```typescript
await queryClient.invalidateQueries({ 
  queryKey: ['next-task', user?.id],
  refetchType: 'active' // Force immediate refetch
});
await refetchTask(); // Immediate refetch
```

### 3. Tasks.tsx - Skip Handler
**Before:**
```typescript
refetchTask();
```

**After:**
```typescript
await queryClient.invalidateQueries({ 
  queryKey: ['next-task', user?.id],
  refetchType: 'active'
});
await refetchTask();
```

### 4. Debug Logging (Development Only)
Added verification logging that checks if a loaded task is already completed (should never happen):
```typescript
useEffect(() => {
  if (currentTask && user && import.meta.env.DEV) {
    // Verify task is not already completed
    supabase
      .from('task_completions')
      .select('id')
      .eq('user_id', user.id)
      .eq('task_id', currentTask.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          console.error('🚨 CRITICAL: Task already completed is being shown!');
        }
      });
  }
}, [currentTask?.id, user?.id]);
```

## Verification Steps

### Manual Testing
1. **Complete a Task**:
   - Log in as a test user
   - Complete a task
   - Verify the task disappears and a new task is shown
   - Check browser console for any error messages

2. **Skip a Task**:
   - Skip a task
   - Verify the skipped task doesn't appear again
   - Verify a new task is shown

3. **Multiple Completions**:
   - Complete 3-5 tasks in a row
   - Verify each completed task never appears again
   - Check that all tasks shown are unique

### Database Verification
Run the SQL test script (`test_task_duplication.sql`) to check:
1. No duplicate task completions exist
2. Completed tasks are properly excluded from available tasks
3. The `get_next_task_optimized` function works correctly

### Automated Testing (Recommended)
Create a test that:
1. Creates a test user
2. Gets a task
3. Completes the task
4. Gets next task
5. Verifies the completed task ID is not in the list of available tasks
6. Repeats for multiple tasks

## Expected Behavior

✅ **Correct Behavior**:
- User completes Task A → Task A never appears again
- User skips Task B → Task B never appears again (if skip logic excludes it)
- Each task is shown only once per user
- Database constraint prevents duplicate completions

❌ **Incorrect Behavior** (Should Never Happen):
- Same task appears after completion
- Task appears multiple times before completion
- Database has duplicate `(user_id, task_id)` entries

## Monitoring

### Development Console
In development mode, check the browser console for:
- `✅ Verified: Task is not completed (as expected)` - Normal behavior
- `🚨 CRITICAL: Task already completed is being shown!` - Indicates a bug

### Production Monitoring
Monitor for:
- `DUPLICATE_SUBMISSION` errors from `complete_task_atomic`
- Database constraint violations on `task_completions`
- User reports of seeing the same task multiple times

## Database Constraints

The following constraints ensure data integrity:

1. **Unique Constraint**: `UNIQUE(user_id, task_id)` on `task_completions`
   - Prevents duplicate entries at the database level
   - Any attempt to insert a duplicate will fail

2. **Foreign Key Constraints**:
   - `user_id` references `auth.users(id) ON DELETE CASCADE`
   - `task_id` references `ai_tasks(id) ON DELETE CASCADE`

3. **Function-Level Checks**:
   - `complete_task_atomic` checks for duplicates before inserting
   - `get_next_task_optimized` excludes completed tasks

## Troubleshooting

### If tasks still appear after completion:

1. **Check Database**:
   ```sql
   -- Find duplicate completions
   SELECT user_id, task_id, COUNT(*) 
   FROM task_completions 
   GROUP BY user_id, task_id 
   HAVING COUNT(*) > 1;
   ```

2. **Check Cache**:
   - Clear browser cache
   - Check React Query DevTools for stale data
   - Verify `staleTime` is set to `0`

3. **Check Edge Function**:
   - Verify `get-next-task` is calling `get_next_task_optimized`
   - Check edge function logs for errors
   - Verify RPC function is working correctly

4. **Check Frontend**:
   - Verify cache invalidation is happening
   - Check network tab for API calls
   - Verify `refetchTask()` is being called after completion

## Summary

The fix ensures:
1. ✅ Database-level protection via unique constraint
2. ✅ Function-level duplicate checking
3. ✅ Query-level exclusion of completed tasks
4. ✅ Frontend cache invalidation and immediate refetch
5. ✅ Debug logging for verification

The system now has **multiple layers of protection** to ensure tasks are never shown twice to the same user.


