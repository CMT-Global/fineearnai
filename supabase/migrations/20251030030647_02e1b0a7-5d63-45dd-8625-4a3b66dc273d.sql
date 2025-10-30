-- Phase 1: Remove upgrade commission logic from process_plan_upgrade_atomic()
-- This ensures uplines are ONLY credited for deposits and tasks, NOT upgrades

CREATE OR REPLACE FUNCTION public.process_plan_upgrade_atomic(
  p_user_id uuid, 
  p_plan_name text, 
  p_final_cost numeric, 
  p_expiry_date timestamp with time zone, 
  p_previous_plan text DEFAULT 'free'::text, 
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_deposit_balance NUMERIC;
  v_new_deposit_balance NUMERIC;
  v_transaction_id UUID;
  v_result JSONB;
BEGIN
  -- Step 1: Lock the user's profile and get current deposit balance
  SELECT deposit_wallet_balance INTO v_current_deposit_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  IF v_current_deposit_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User profile not found',
      'error_code', 'PROFILE_NOT_FOUND'
    );
  END IF;
  
  -- Step 2: Validate sufficient balance
  IF v_current_deposit_balance < p_final_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'error_code', 'INSUFFICIENT_BALANCE',
      'current_balance', v_current_deposit_balance,
      'required_amount', p_final_cost
    );
  END IF;
  
  -- Step 3: Calculate new deposit balance
  v_new_deposit_balance := v_current_deposit_balance - p_final_cost;
  
  -- Step 4: Update profile with new plan and balance
  UPDATE profiles
  SET
    membership_plan = p_plan_name,
    plan_expires_at = p_expiry_date,
    current_plan_start_date = NOW(),
    deposit_wallet_balance = v_new_deposit_balance,
    last_activity = NOW()
  WHERE id = p_user_id;
  
  -- Step 5: Create transaction record for plan upgrade
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
    p_user_id,
    'plan_upgrade',
    p_final_cost,
    'deposit',
    v_new_deposit_balance,
    'completed',
    'Upgraded to ' || p_plan_name || ' plan',
    p_metadata,
    NOW()
  ) RETURNING id INTO v_transaction_id;
  
  -- Step 6: Return success result (NO COMMISSION PROCESSING)
  v_result := jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'old_deposit_balance', v_current_deposit_balance,
    'new_deposit_balance', v_new_deposit_balance,
    'amount_charged', p_final_cost,
    'plan_name', p_plan_name,
    'expires_at', p_expiry_date
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  -- Return error result (transaction will be rolled back automatically)
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'error_code', 'TRANSACTION_FAILED',
    'sql_state', SQLSTATE
  );
END;
$function$;