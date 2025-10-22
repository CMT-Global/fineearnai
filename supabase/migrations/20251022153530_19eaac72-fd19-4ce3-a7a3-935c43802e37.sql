-- Phase 6: Atomic Deposit Function for Race-Condition Protection
-- This function uses row-level locking (FOR UPDATE) to ensure that concurrent
-- deposits for the same user are processed sequentially, preventing balance loss.

CREATE OR REPLACE FUNCTION public.credit_deposit_atomic(
  p_user_id UUID,
  p_amount NUMERIC,
  p_order_id TEXT,
  p_payment_method TEXT DEFAULT 'cpay',
  p_gateway_transaction_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
  v_existing_tx UUID;
BEGIN
  -- Step 1: Check for existing completed transaction with this order_id (idempotency)
  SELECT id INTO v_existing_tx
  FROM transactions
  WHERE gateway_transaction_id = p_order_id
    AND type = 'deposit'
    AND status = 'completed'
  LIMIT 1;
  
  IF v_existing_tx IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'duplicate_transaction',
      'message', 'Transaction already processed',
      'transaction_id', v_existing_tx
    );
  END IF;
  
  -- Step 2: Lock the user's profile row and get current balance
  -- FOR UPDATE ensures no other transaction can modify this row until we commit
  SELECT deposit_wallet_balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'user_not_found',
      'message', 'User profile not found'
    );
  END IF;
  
  -- Step 3: Calculate new balance
  v_new_balance := v_current_balance + p_amount;
  
  -- Step 4: Insert transaction record FIRST (before balance update for validation trigger)
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
  
  -- Step 5: Update profile balance atomically
  UPDATE profiles
  SET 
    deposit_wallet_balance = v_new_balance,
    last_activity = NOW()
  WHERE id = p_user_id;
  
  -- Step 6: Return success result
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'old_balance', v_current_balance,
    'new_balance', v_new_balance,
    'amount_credited', p_amount
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Return error result (transaction will be rolled back automatically)
  RETURN jsonb_build_object(
    'success', false,
    'error', 'transaction_failed',
    'message', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.credit_deposit_atomic TO authenticated, service_role;

COMMENT ON FUNCTION public.credit_deposit_atomic IS 
'Atomically credits a deposit to user wallet with row-level locking to prevent race conditions. 
Includes idempotency check and returns detailed result object.';
