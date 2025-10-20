-- Phase 1.2: Make Task Completion Atomic
-- Create atomic task completion function that wraps everything in a transaction

CREATE OR REPLACE FUNCTION public.complete_task_atomic(
  p_user_id UUID,
  p_task_id UUID,
  p_selected_response TEXT,
  p_time_taken_seconds INTEGER,
  p_is_correct BOOLEAN,
  p_earnings_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_plan RECORD;
  v_task RECORD;
  v_new_earnings_balance NUMERIC;
  v_new_total_earned NUMERIC;
  v_task_completion_id UUID;
  v_transaction_id UUID;
  v_result JSONB;
BEGIN
  -- Step 1: Lock the user profile row and get current state
  SELECT * INTO v_profile
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;  -- Row-level lock prevents concurrent modifications
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Profile not found',
      'error_code', 'PROFILE_NOT_FOUND'
    );
  END IF;
  
  -- Step 2: Get membership plan details
  SELECT * INTO v_plan
  FROM membership_plans
  WHERE name = v_profile.membership_plan
  AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Membership plan not found or inactive',
      'error_code', 'INVALID_PLAN'
    );
  END IF;
  
  -- Step 3: Re-verify daily limit inside transaction (critical for race condition prevention)
  IF v_profile.tasks_completed_today >= v_plan.daily_task_limit THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Daily task limit reached',
      'error_code', 'DAILY_LIMIT_REACHED',
      'tasks_completed_today', v_profile.tasks_completed_today,
      'daily_task_limit', v_plan.daily_task_limit
    );
  END IF;
  
  -- Step 4: Verify task exists and is active
  SELECT * INTO v_task
  FROM ai_tasks
  WHERE id = p_task_id
  AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Task not found or inactive',
      'error_code', 'INVALID_TASK'
    );
  END IF;
  
  -- Step 5: Check for duplicate submission
  IF EXISTS (
    SELECT 1 FROM task_completions
    WHERE user_id = p_user_id
    AND task_id = p_task_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Task already completed',
      'error_code', 'DUPLICATE_SUBMISSION'
    );
  END IF;
  
  -- Step 6: Calculate new balances
  v_new_earnings_balance := v_profile.earnings_wallet_balance + p_earnings_amount;
  v_new_total_earned := v_profile.total_earned + p_earnings_amount;
  
  -- Step 7: Insert task completion record
  INSERT INTO task_completions (
    user_id,
    task_id,
    selected_response,
    is_correct,
    earnings_amount,
    time_taken_seconds,
    completed_at
  ) VALUES (
    p_user_id,
    p_task_id,
    p_selected_response,
    p_is_correct,
    p_earnings_amount,
    p_time_taken_seconds,
    NOW()
  ) RETURNING id INTO v_task_completion_id;
  
  -- Step 8: Insert transaction record (only if earnings > 0)
  IF p_earnings_amount > 0 THEN
    INSERT INTO transactions (
      user_id,
      type,
      amount,
      wallet_type,
      status,
      new_balance,
      description,
      metadata,
      created_at
    ) VALUES (
      p_user_id,
      'task_earning',
      p_earnings_amount,
      'earnings',
      'completed',
      v_new_earnings_balance,
      'Earned from completing AI training task',
      jsonb_build_object(
        'task_id', p_task_id,
        'task_completion_id', v_task_completion_id,
        'is_correct', p_is_correct,
        'time_taken_seconds', p_time_taken_seconds
      ),
      NOW()
    ) RETURNING id INTO v_transaction_id;
  END IF;
  
  -- Step 9: Update profile (atomic with all inserts)
  UPDATE profiles
  SET
    tasks_completed_today = tasks_completed_today + 1,
    earnings_wallet_balance = v_new_earnings_balance,
    total_earned = v_new_total_earned,
    last_task_date = CURRENT_DATE,
    last_activity = NOW()
  WHERE id = p_user_id;
  
  -- Step 10: Return success result
  v_result := jsonb_build_object(
    'success', true,
    'task_completion_id', v_task_completion_id,
    'transaction_id', v_transaction_id,
    'is_correct', p_is_correct,
    'earnings_amount', p_earnings_amount,
    'new_earnings_balance', v_new_earnings_balance,
    'new_total_earned', v_new_total_earned,
    'tasks_completed_today', v_profile.tasks_completed_today + 1,
    'daily_task_limit', v_plan.daily_task_limit,
    'remaining_tasks', v_plan.daily_task_limit - (v_profile.tasks_completed_today + 1)
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  -- Catch any errors and rollback automatically
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'error_code', 'TRANSACTION_FAILED'
  );
END;
$$;