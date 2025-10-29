-- Phase 4: Add Comprehensive Logging to Atomic Commission Functions
-- This migration recreates atomic functions with detailed RAISE NOTICE logging
-- to diagnose why commissions are not being processed

-- ============================================================================
-- Drop and Recreate complete_task_atomic with Logging
-- ============================================================================
DROP FUNCTION IF EXISTS public.complete_task_atomic(uuid, uuid, text, integer, boolean, numeric);

CREATE OR REPLACE FUNCTION public.complete_task_atomic(
  p_user_id uuid,
  p_task_id uuid,
  p_selected_response text,
  p_time_taken_seconds integer,
  p_is_correct boolean,
  p_earnings_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile RECORD;
  v_plan RECORD;
  v_task RECORD;
  v_new_earnings_balance NUMERIC;
  v_new_total_earned NUMERIC;
  v_task_completion_id UUID;
  v_transaction_id UUID;
  v_result JSONB;
  
  -- Commission variables
  v_referral RECORD;
  v_referrer_plan RECORD;
  v_commission_rate NUMERIC := 0;
  v_commission_amount NUMERIC := 0;
  v_commission_transaction_id UUID;
  v_referral_earning_id UUID;
  v_new_referrer_balance NUMERIC;
BEGIN
  RAISE NOTICE '[TASK] Starting task completion for user=%, task=%, earnings=%', p_user_id, p_task_id, p_earnings_amount;
  
  -- Step 1: Lock the user profile row and get current state
  SELECT * INTO v_profile
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE NOTICE '[TASK] ERROR: Profile not found for user=%', p_user_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Profile not found',
      'error_code', 'PROFILE_NOT_FOUND'
    );
  END IF;
  
  RAISE NOTICE '[TASK] Profile locked: user=%, plan=%, tasks_today=%', v_profile.username, v_profile.membership_plan, v_profile.tasks_completed_today;
  
  -- Step 2: Get membership plan details
  SELECT * INTO v_plan
  FROM membership_plans
  WHERE name = v_profile.membership_plan
  AND is_active = true;
  
  IF NOT FOUND THEN
    RAISE NOTICE '[TASK] ERROR: Plan not found or inactive: plan=%', v_profile.membership_plan;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Membership plan not found or inactive',
      'error_code', 'INVALID_PLAN'
    );
  END IF;
  
  RAISE NOTICE '[TASK] Plan details: name=%, daily_limit=%, task_commission_rate=%', v_plan.name, v_plan.daily_task_limit, v_plan.task_commission_rate;
  
  -- Step 3: Re-verify daily limit inside transaction
  IF v_profile.tasks_completed_today >= v_plan.daily_task_limit THEN
    RAISE NOTICE '[TASK] ERROR: Daily limit reached: completed=%, limit=%', v_profile.tasks_completed_today, v_plan.daily_task_limit;
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
    RAISE NOTICE '[TASK] ERROR: Task not found or inactive: task=%', p_task_id;
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
    RAISE NOTICE '[TASK] ERROR: Duplicate submission: user=%, task=%', p_user_id, p_task_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Task already completed',
      'error_code', 'DUPLICATE_SUBMISSION'
    );
  END IF;
  
  -- Step 6: Calculate new balances
  v_new_earnings_balance := v_profile.earnings_wallet_balance + p_earnings_amount;
  v_new_total_earned := v_profile.total_earned + p_earnings_amount;
  
  RAISE NOTICE '[TASK] Balance calculation: old=%, earning=%, new=%', v_profile.earnings_wallet_balance, p_earnings_amount, v_new_earnings_balance;
  
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
  
  RAISE NOTICE '[TASK] Task completion created: id=%', v_task_completion_id;
  
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
    
    RAISE NOTICE '[TASK] Transaction created: id=%', v_transaction_id;
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
  
  RAISE NOTICE '[TASK] Profile updated: tasks_today=%, balance=%', v_profile.tasks_completed_today + 1, v_new_earnings_balance;
  
  -- ========================================================================
  -- Step 10: Process Referral Commission Atomically
  -- ========================================================================
  RAISE NOTICE '[COMMISSION] Starting commission check for user=%', p_user_id;
  
  IF p_earnings_amount > 0 THEN
    -- Get active referral relationship
    SELECT * INTO v_referral
    FROM referrals
    WHERE referred_id = p_user_id
    AND status = 'active'
    LIMIT 1;
    
    IF v_referral IS NOT NULL THEN
      RAISE NOTICE '[COMMISSION] Active referral found: referrer=%, referred=%, status=%', v_referral.referrer_id, v_referral.referred_id, v_referral.status;
      
      -- Get referrer's membership plan details
      SELECT mp.* INTO v_referrer_plan
      FROM profiles p
      INNER JOIN membership_plans mp ON mp.name = p.membership_plan
      WHERE p.id = v_referral.referrer_id
      AND mp.is_active = true;
      
      IF v_referrer_plan IS NOT NULL THEN
        v_commission_rate := v_referrer_plan.task_commission_rate;
        RAISE NOTICE '[COMMISSION] Referrer plan: name=%, task_commission_rate=%', v_referrer_plan.name, v_commission_rate;
        
        -- Calculate commission (task commission rate on task earnings)
        IF v_commission_rate > 0 THEN
          v_commission_amount := ROUND(p_earnings_amount * v_commission_rate, 4);
          RAISE NOTICE '[COMMISSION] Commission calculated: base=%, rate=%, amount=%', p_earnings_amount, v_commission_rate, v_commission_amount;
          
          -- Lock referrer's profile and get current balance
          SELECT earnings_wallet_balance INTO v_new_referrer_balance
          FROM profiles
          WHERE id = v_referral.referrer_id
          FOR UPDATE;
          
          RAISE NOTICE '[COMMISSION] Referrer locked: old_balance=%', v_new_referrer_balance;
          
          -- Update referrer's balance
          v_new_referrer_balance := v_new_referrer_balance + v_commission_amount;
          
          UPDATE profiles
          SET
            earnings_wallet_balance = v_new_referrer_balance,
            total_earned = total_earned + v_commission_amount,
            last_activity = NOW()
          WHERE id = v_referral.referrer_id;
          
          RAISE NOTICE '[COMMISSION] Referrer balance updated: new_balance=%', v_new_referrer_balance;
          
          -- Create commission transaction for referrer
          INSERT INTO transactions (
            user_id,
            type,
            amount,
            wallet_type,
            new_balance,
            status,
            description,
            metadata,
            created_at
          ) VALUES (
            v_referral.referrer_id,
            'referral_commission',
            v_commission_amount,
            'earnings',
            v_new_referrer_balance,
            'completed',
            'Referral commission from task completion',
            jsonb_build_object(
              'source_event', 'task_completion',
              'referred_user_id', p_user_id,
              'base_amount', p_earnings_amount,
              'commission_rate', v_commission_rate,
              'task_id', p_task_id,
              'task_completion_id', v_task_completion_id,
              'transaction_id', v_transaction_id,
              'processed_atomically', true
            ),
            NOW()
          ) RETURNING id INTO v_commission_transaction_id;
          
          RAISE NOTICE '[COMMISSION] Commission transaction created: id=%', v_commission_transaction_id;
          
          -- Create referral_earnings record
          INSERT INTO referral_earnings (
            referrer_id,
            referred_user_id,
            earning_type,
            base_amount,
            commission_rate,
            commission_amount,
            metadata,
            created_at
          ) VALUES (
            v_referral.referrer_id,
            p_user_id,
            'task_completion',
            p_earnings_amount,
            v_commission_rate,
            v_commission_amount,
            jsonb_build_object(
              'task_id', p_task_id,
              'task_completion_id', v_task_completion_id,
              'transaction_id', v_transaction_id,
              'commission_transaction_id', v_commission_transaction_id,
              'processed_atomically', true
            ),
            NOW()
          ) RETURNING id INTO v_referral_earning_id;
          
          RAISE NOTICE '[COMMISSION] Referral earning created: id=%', v_referral_earning_id;
          
          -- Update referral total commission
          UPDATE referrals
          SET
            total_commission_earned = total_commission_earned + v_commission_amount,
            last_commission_date = NOW()
          WHERE id = v_referral.id;
          
          RAISE NOTICE '[COMMISSION] SUCCESS: Referrer commission processed: referrer=%, amount=%, total_earned=%', v_referral.referrer_id, v_commission_amount, v_referral.total_commission_earned + v_commission_amount;
        ELSE
          RAISE NOTICE '[COMMISSION] SKIPPED: Commission rate is zero';
        END IF;
      ELSE
        RAISE NOTICE '[COMMISSION] SKIPPED: Referrer plan not found or inactive for referrer=%', v_referral.referrer_id;
      END IF;
    ELSE
      RAISE NOTICE '[COMMISSION] SKIPPED: No active referral relationship found for user=%', p_user_id;
    END IF;
  ELSE
    RAISE NOTICE '[COMMISSION] SKIPPED: No earnings amount (amount=%)', p_earnings_amount;
  END IF;
  
  -- Step 11: Return success result
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
    'remaining_tasks', v_plan.daily_task_limit - (v_profile.tasks_completed_today + 1),
    'commission_processed', v_commission_amount > 0,
    'commission_amount', v_commission_amount,
    'commission_transaction_id', v_commission_transaction_id,
    'referral_earning_id', v_referral_earning_id
  );
  
  RAISE NOTICE '[TASK] Function complete: success=true, commission_processed=%', v_commission_amount > 0;
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[TASK] EXCEPTION: error=%, detail=%', SQLERRM, SQLSTATE;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'error_code', 'TRANSACTION_FAILED'
  );
END;
$function$;

-- ============================================================================
-- Drop and Recreate credit_deposit_atomic with Logging
-- ============================================================================
DROP FUNCTION IF EXISTS public.credit_deposit_atomic(uuid, numeric, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.credit_deposit_atomic(
  p_user_id uuid,
  p_amount numeric,
  p_order_id text,
  p_payment_method text DEFAULT 'cpay'::text,
  p_gateway_transaction_id text DEFAULT NULL::text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
  v_existing_tx UUID;
  
  -- Commission variables
  v_referral RECORD;
  v_referrer_plan RECORD;
  v_commission_rate NUMERIC := 0;
  v_commission_amount NUMERIC := 0;
  v_commission_transaction_id UUID;
  v_referral_earning_id UUID;
  v_new_referrer_balance NUMERIC;
BEGIN
  RAISE NOTICE '[DEPOSIT] Starting deposit for user=%, amount=%, order=%', p_user_id, p_amount, p_order_id;
  
  -- Step 1: Check for existing completed transaction (idempotency)
  SELECT id INTO v_existing_tx
  FROM transactions
  WHERE gateway_transaction_id = p_order_id
    AND type = 'deposit'
    AND status = 'completed'
  LIMIT 1;
  
  IF v_existing_tx IS NOT NULL THEN
    RAISE NOTICE '[DEPOSIT] DUPLICATE: Transaction already processed: tx=%', v_existing_tx;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'duplicate_transaction',
      'message', 'Transaction already processed',
      'transaction_id', v_existing_tx
    );
  END IF;
  
  -- Step 2: Lock user's profile and get current balance
  SELECT deposit_wallet_balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  IF v_current_balance IS NULL THEN
    RAISE NOTICE '[DEPOSIT] ERROR: User not found: user=%', p_user_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'user_not_found',
      'message', 'User profile not found'
    );
  END IF;
  
  RAISE NOTICE '[DEPOSIT] Profile locked: old_balance=%', v_current_balance;
  
  -- Step 3: Calculate new balance
  v_new_balance := v_current_balance + p_amount;
  RAISE NOTICE '[DEPOSIT] Balance calculation: old=%, amount=%, new=%', v_current_balance, p_amount, v_new_balance;
  
  -- Step 4: Insert transaction record
  INSERT INTO transactions (
    user_id,
    type,
    amount,
    wallet_type,
    new_balance,
    description,
    status,
    payment_gateway,
    gateway_transaction_id,
    metadata,
    created_at
  ) VALUES (
    p_user_id,
    'deposit',
    p_amount,
    'deposit',
    v_new_balance,
    'Deposit via ' || p_payment_method,
    'completed',
    p_payment_method,
    p_order_id,
    p_metadata,
    NOW()
  )
  RETURNING id INTO v_transaction_id;
  
  RAISE NOTICE '[DEPOSIT] Transaction created: id=%', v_transaction_id;
  
  -- Step 5: Update profile balance atomically
  UPDATE profiles
  SET 
    deposit_wallet_balance = v_new_balance,
    last_activity = NOW()
  WHERE id = p_user_id;
  
  RAISE NOTICE '[DEPOSIT] Profile updated: new_balance=%', v_new_balance;
  
  -- ========================================================================
  -- Step 6: Process Referral Commission Atomically
  -- ========================================================================
  RAISE NOTICE '[COMMISSION] Starting commission check for deposit user=%', p_user_id;
  
  -- Get active referral relationship
  SELECT * INTO v_referral
  FROM referrals
  WHERE referred_id = p_user_id
  AND status = 'active'
  LIMIT 1;
  
  IF v_referral IS NOT NULL THEN
    RAISE NOTICE '[COMMISSION] Active referral found: referrer=%, referred=%', v_referral.referrer_id, v_referral.referred_id;
    
    -- Get referrer's membership plan details
    SELECT mp.* INTO v_referrer_plan
    FROM profiles p
    INNER JOIN membership_plans mp ON mp.name = p.membership_plan
    WHERE p.id = v_referral.referrer_id
    AND mp.is_active = true;
    
    IF v_referrer_plan IS NOT NULL THEN
      v_commission_rate := v_referrer_plan.deposit_commission_rate;
      RAISE NOTICE '[COMMISSION] Referrer plan: name=%, deposit_commission_rate=%', v_referrer_plan.name, v_commission_rate;
      
      -- Calculate commission (deposit commission rate on deposit amount)
      IF v_commission_rate > 0 THEN
        v_commission_amount := ROUND(p_amount * v_commission_rate, 4);
        RAISE NOTICE '[COMMISSION] Commission calculated: base=%, rate=%, amount=%', p_amount, v_commission_rate, v_commission_amount;
        
        -- Lock referrer's profile and get current balance
        SELECT earnings_wallet_balance INTO v_new_referrer_balance
        FROM profiles
        WHERE id = v_referral.referrer_id
        FOR UPDATE;
        
        RAISE NOTICE '[COMMISSION] Referrer locked: old_balance=%', v_new_referrer_balance;
        
        -- Update referrer's balance
        v_new_referrer_balance := v_new_referrer_balance + v_commission_amount;
        
        UPDATE profiles
        SET
          earnings_wallet_balance = v_new_referrer_balance,
          total_earned = total_earned + v_commission_amount,
          last_activity = NOW()
        WHERE id = v_referral.referrer_id;
        
        RAISE NOTICE '[COMMISSION] Referrer balance updated: new_balance=%', v_new_referrer_balance;
        
        -- Create commission transaction for referrer
        INSERT INTO transactions (
          user_id,
          type,
          amount,
          wallet_type,
          new_balance,
          status,
          description,
          metadata,
          created_at
        ) VALUES (
          v_referral.referrer_id,
          'referral_commission',
          v_commission_amount,
          'earnings',
          v_new_referrer_balance,
          'completed',
          'Referral commission from deposit',
          jsonb_build_object(
            'source_event', 'deposit',
            'referred_user_id', p_user_id,
            'base_amount', p_amount,
            'commission_rate', v_commission_rate,
            'transaction_id', v_transaction_id,
            'processed_atomically', true
          ),
          NOW()
        ) RETURNING id INTO v_commission_transaction_id;
        
        RAISE NOTICE '[COMMISSION] Commission transaction created: id=%', v_commission_transaction_id;
        
        -- Create referral_earnings record
        INSERT INTO referral_earnings (
          referrer_id,
          referred_user_id,
          earning_type,
          base_amount,
          commission_rate,
          commission_amount,
          metadata,
          created_at
        ) VALUES (
          v_referral.referrer_id,
          p_user_id,
          'deposit',
          p_amount,
          v_commission_rate,
          v_commission_amount,
          jsonb_build_object(
            'transaction_id', v_transaction_id,
            'commission_transaction_id', v_commission_transaction_id,
            'processed_atomically', true
          ),
          NOW()
        ) RETURNING id INTO v_referral_earning_id;
        
        RAISE NOTICE '[COMMISSION] Referral earning created: id=%', v_referral_earning_id;
        
        -- Update referral total commission
        UPDATE referrals
        SET
          total_commission_earned = total_commission_earned + v_commission_amount,
          last_commission_date = NOW()
        WHERE id = v_referral.id;
        
        RAISE NOTICE '[COMMISSION] SUCCESS: Deposit commission processed: referrer=%, amount=%', v_referral.referrer_id, v_commission_amount;
      ELSE
        RAISE NOTICE '[COMMISSION] SKIPPED: Commission rate is zero';
      END IF;
    ELSE
      RAISE NOTICE '[COMMISSION] SKIPPED: Referrer plan not found';
    END IF;
  ELSE
    RAISE NOTICE '[COMMISSION] SKIPPED: No active referral';
  END IF;
  
  -- Step 7: Return success result
  RAISE NOTICE '[DEPOSIT] Function complete: success=true, commission_processed=%', v_commission_amount > 0;
  
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'old_balance', v_current_balance,
    'new_balance', v_new_balance,
    'amount_credited', p_amount,
    'commission_processed', v_commission_amount > 0,
    'commission_amount', v_commission_amount,
    'commission_transaction_id', v_commission_transaction_id,
    'referral_earning_id', v_referral_earning_id
  );
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[DEPOSIT] EXCEPTION: error=%, detail=%', SQLERRM, SQLSTATE;
  RETURN jsonb_build_object(
    'success', false,
    'error', 'transaction_failed',
    'message', SQLERRM,
    'detail', SQLSTATE
  );
END;
$function$;

COMMENT ON FUNCTION public.complete_task_atomic IS 'Phase 4: Enhanced with comprehensive logging for commission debugging';
COMMENT ON FUNCTION public.credit_deposit_atomic IS 'Phase 4: Enhanced with comprehensive logging for commission debugging';