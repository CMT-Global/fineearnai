-- Phase 6 Fix: Remove function overload conflict

-- Drop the old TEXT version of the function explicitly
DROP FUNCTION IF EXISTS public.process_withdrawal_request_atomic(
  p_user_id uuid,
  p_amount numeric,
  p_fee numeric,
  p_net_amount numeric,
  p_payout_address text,
  p_payment_method text,
  p_payment_processor_id text
);

-- Verify the UUID version exists (this should already exist from Phase 3)
-- If it doesn't exist, create it
CREATE OR REPLACE FUNCTION public.process_withdrawal_request_atomic(
  p_user_id uuid,
  p_amount numeric,
  p_fee numeric,
  p_net_amount numeric,
  p_payout_address text,
  p_payment_method text,
  p_payment_processor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_withdrawal_request_id UUID;
  v_transaction_id UUID;
  v_result JSONB;
BEGIN
  -- Step 1: Lock the user's profile row and get current balance
  SELECT earnings_wallet_balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User profile not found',
      'error_code', 'PROFILE_NOT_FOUND'
    );
  END IF;
  
  -- Step 2: Validate sufficient balance
  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'error_code', 'INSUFFICIENT_BALANCE',
      'current_balance', v_current_balance,
      'requested_amount', p_amount
    );
  END IF;
  
  -- Step 3: Calculate new balance after deduction
  v_new_balance := v_current_balance - p_amount;
  
  -- Step 4: Update profile balance atomically
  UPDATE profiles
  SET 
    earnings_wallet_balance = v_new_balance,
    last_activity = NOW()
  WHERE id = p_user_id;
  
  -- Step 5: Create withdrawal request record
  INSERT INTO withdrawal_requests (
    user_id,
    amount,
    fee,
    net_amount,
    payout_address,
    payment_method,
    payment_processor_id,
    status,
    created_at
  ) VALUES (
    p_user_id,
    p_amount,
    p_fee,
    p_net_amount,
    p_payout_address,
    p_payment_method,
    p_payment_processor_id,
    'pending',
    NOW()
  )
  RETURNING id INTO v_withdrawal_request_id;
  
  -- Step 6: Create transaction record
  INSERT INTO transactions (
    user_id,
    type,
    amount,
    wallet_type,
    new_balance,
    status,
    description,
    payment_gateway,
    metadata,
    created_at
  ) VALUES (
    p_user_id,
    'withdrawal',
    p_amount,
    'earnings',
    v_new_balance,
    'pending',
    'Withdrawal request created',
    p_payment_method,
    jsonb_build_object(
      'withdrawal_request_id', v_withdrawal_request_id,
      'fee', p_fee,
      'net_amount', p_net_amount,
      'payout_address', p_payout_address,
      'payment_processor_id', p_payment_processor_id
    ),
    NOW()
  )
  RETURNING id INTO v_transaction_id;
  
  -- Step 7: Return success result with all details
  v_result := jsonb_build_object(
    'success', true,
    'withdrawal_request_id', v_withdrawal_request_id,
    'transaction_id', v_transaction_id,
    'old_balance', v_current_balance,
    'new_balance', v_new_balance,
    'amount_withdrawn', p_amount,
    'fee', p_fee,
    'net_amount', p_net_amount
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'error_code', 'TRANSACTION_FAILED',
    'sql_state', SQLSTATE
  );
END;
$function$;