-- Test script to verify that completed tasks are not shown again to users
-- This script checks:
-- 1. That get_next_task_optimized excludes completed tasks
-- 2. That task_completions are properly recorded
-- 3. That duplicate submissions are prevented

-- Step 1: Check if there are any duplicate task completions for the same user
SELECT 
    user_id,
    task_id,
    COUNT(*) as completion_count,
    MIN(completed_at) as first_completion,
    MAX(completed_at) as last_completion
FROM task_completions
GROUP BY user_id, task_id
HAVING COUNT(*) > 1
ORDER BY completion_count DESC
LIMIT 20;

-- Step 2: For a specific user, check what tasks they've completed vs what's available
-- Replace 'USER_ID_HERE' with an actual user ID
DO $$
DECLARE
    v_test_user_id UUID := 'USER_ID_HERE'; -- Replace with actual user ID
    v_completed_tasks UUID[];
    v_available_tasks UUID[];
    v_overlap UUID[];
BEGIN
    -- Get all completed task IDs for this user
    SELECT ARRAY_AGG(task_id) INTO v_completed_tasks
    FROM task_completions
    WHERE user_id = v_test_user_id;
    
    -- Get all available tasks for this user (using the same logic as get_next_task_optimized)
    SELECT ARRAY_AGG(t.id) INTO v_available_tasks
    FROM ai_tasks t
    WHERE t.is_active = true
    AND NOT EXISTS (
        SELECT 1
        FROM task_completions tc
        WHERE tc.user_id = v_test_user_id
        AND tc.task_id = t.id
    );
    
    -- Find any overlap (should be empty)
    SELECT ARRAY_AGG(task_id) INTO v_overlap
    FROM unnest(v_completed_tasks) AS task_id
    WHERE task_id = ANY(v_available_tasks);
    
    RAISE NOTICE 'User ID: %', v_test_user_id;
    RAISE NOTICE 'Completed tasks count: %', array_length(v_completed_tasks, 1);
    RAISE NOTICE 'Available tasks count: %', array_length(v_available_tasks, 1);
    
    IF v_overlap IS NOT NULL AND array_length(v_overlap, 1) > 0 THEN
        RAISE WARNING 'PROBLEM FOUND: % completed tasks are showing as available!', array_length(v_overlap, 1);
        RAISE NOTICE 'Overlapping task IDs: %', v_overlap;
    ELSE
        RAISE NOTICE 'SUCCESS: No completed tasks are showing as available';
    END IF;
END $$;

-- Step 3: Test the get_next_task_optimized function for a specific user
-- Replace 'USER_ID_HERE' with an actual user ID
SELECT 
    task_id,
    category,
    difficulty,
    created_at,
    available_count
FROM get_next_task_optimized('USER_ID_HERE'); -- Replace with actual user ID

-- Step 4: Verify that the task returned is NOT in task_completions for that user
-- Replace 'USER_ID_HERE' and 'TASK_ID_HERE' with actual values
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM task_completions 
            WHERE user_id = 'USER_ID_HERE' 
            AND task_id = 'TASK_ID_HERE'
        ) THEN 'ERROR: Task already completed!'
        ELSE 'OK: Task not completed yet'
    END as verification_status;

-- Step 5: Check for any orphaned or invalid task_completions
SELECT 
    tc.id,
    tc.user_id,
    tc.task_id,
    tc.completed_at,
    CASE 
        WHEN u.id IS NULL THEN 'ERROR: User does not exist'
        WHEN t.id IS NULL THEN 'ERROR: Task does not exist'
        WHEN t.is_active = false THEN 'WARNING: Task is inactive'
        ELSE 'OK'
    END as validation_status
FROM task_completions tc
LEFT JOIN auth.users u ON u.id = tc.user_id
LEFT JOIN ai_tasks t ON t.id = tc.task_id
WHERE u.id IS NULL OR t.id IS NULL OR t.is_active = false
LIMIT 20;

