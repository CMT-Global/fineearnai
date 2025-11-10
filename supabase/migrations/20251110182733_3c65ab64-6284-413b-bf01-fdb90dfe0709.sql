-- Fix transaction type for voucher purchases
-- Change from 'transfer' to 'voucher_purchase' for proper display

CREATE OR REPLACE FUNCTION public.purchase_voucher_atomic(
  p_partner_id UUID,
  p_voucher_code TEXT,
  p_voucher_amount NUMERIC,
  p_partner_paid_amount NUMERIC,
  p_commission_amount NUMERIC,
  p_commission_rate NUMERIC,
  p_notes TEXT DEFAULT NULL,
  p_recipient_username TEXT DEFAULT NULL,
  p_recipient_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voucher_id UUID;
  v_transaction_id UUID;
  v_old_balance NUMERIC;
  v_new_balance NUMERIC;
  v_current_balance NUMERIC;
  v_amount NUMERIC;
  v_commission NUMERIC;
  v_voucher_amount NUMERIC;
  v_total_vouchers_sold INT;
  v_daily_sales NUMERIC;
  v_current_rank TEXT;
BEGIN
  RAISE NOTICE '[VOUCHER-ATOMIC] Starting atomic voucher purchase';
  RAISE NOTICE '[VOUCHER-ATOMIC] Partner: %, Code: %, Amount: %', p_partner_id, p_voucher_code, p_voucher_amount;

  -- Apply explicit rounding to all monetary inputs
  v_amount := ROUND(p_partner_paid_amount, 2);
  v_commission := ROUND(p_commission_amount, 2);
  v_voucher_amount := ROUND(p_voucher_amount, 2);

  RAISE NOTICE '[VOUCHER-ATOMIC] Rounded amounts - Partner Paid: %, Commission: %, Voucher: %', 
    v_amount, v_commission, v_voucher_amount;

  -- Step 1: Lock partner's profile and get current balance
  SELECT deposit_wallet_balance INTO v_current_balance
  FROM public.profiles
  WHERE id = p_partner_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'Partner profile not found';
  END IF;

  v_old_balance := v_current_balance;
  RAISE NOTICE '[VOUCHER-ATOMIC] Current balance (locked): %', v_current_balance;

  -- Step 2: Validate sufficient balance
  IF v_current_balance < v_amount THEN
    RAISE NOTICE '[VOUCHER-ATOMIC] Insufficient balance: % < %', v_current_balance, v_amount;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient deposit wallet balance',
      'error_code', 'INSUFFICIENT_BALANCE',
      'current_balance', v_current_balance,
      'required_amount', v_amount
    );
  END IF;

  -- Step 3: Calculate new balance with explicit rounding
  v_new_balance := ROUND(v_current_balance - v_amount, 2);
  RAISE NOTICE '[VOUCHER-ATOMIC] Balance calculation: % - % = %', v_current_balance, v_amount, v_new_balance;

  -- Step 4: Insert transaction FIRST (before updating profile)
  -- This ensures the validator sees the old balance in profiles
  INSERT INTO public.transactions (
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
    p_partner_id,
    'voucher_purchase',  -- Changed from 'transfer' to 'voucher_purchase'
    v_amount,
    'deposit',
    v_new_balance,
    'completed',
    'Purchased voucher code: ' || p_voucher_code,
    'internal',
    jsonb_build_object(
      'voucher_code', p_voucher_code,
      'voucher_amount', v_voucher_amount,
      'commission_amount', v_commission,
      'commission_rate', p_commission_rate,
      'recipient_username', p_recipient_username,
      'recipient_email', p_recipient_email,
      'notes', p_notes
    ),
    NOW()
  ) RETURNING id INTO v_transaction_id;

  RAISE NOTICE '[VOUCHER-ATOMIC] Transaction inserted: %, New balance in tx: %', v_transaction_id, v_new_balance;

  -- Step 5: Update profile balance AFTER transaction insert
  UPDATE public.profiles
  SET 
    deposit_wallet_balance = v_new_balance,
    last_activity = NOW()
  WHERE id = p_partner_id;

  RAISE NOTICE '[VOUCHER-ATOMIC] Profile updated to new balance: %', v_new_balance;

  -- Step 6: Create voucher
  INSERT INTO public.vouchers (
    partner_id,
    voucher_code,
    voucher_amount,
    commission_rate,
    status,
    notes,
    recipient_username,
    recipient_email,
    purchase_transaction_id,
    created_at,
    expires_at
  ) VALUES (
    p_partner_id,
    p_voucher_code,
    v_voucher_amount,
    p_commission_rate,
    'active',
    p_notes,
    p_recipient_username,
    p_recipient_email,
    v_transaction_id,
    NOW(),
    NOW() + INTERVAL '30 days'
  ) RETURNING id, expires_at INTO v_voucher_id;

  RAISE NOTICE '[VOUCHER-ATOMIC] Voucher created: %', v_voucher_id;

  -- Step 7: Update partner stats
  UPDATE public.partner_config
  SET 
    total_vouchers_sold = total_vouchers_sold + 1,
    daily_sales = daily_sales + v_voucher_amount,
    weekly_sales = weekly_sales + v_voucher_amount,
    total_commission_earned = total_commission_earned + v_commission,
    last_sale_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_partner_id
  RETURNING total_vouchers_sold, daily_sales, current_rank 
  INTO v_total_vouchers_sold, v_daily_sales, v_current_rank;

  RAISE NOTICE '[VOUCHER-ATOMIC] Partner stats updated - Total: %, Daily: %, Rank: %', 
    v_total_vouchers_sold, v_daily_sales, v_current_rank;

  -- Step 8: Log activity
  INSERT INTO public.partner_activity_log (
    partner_id,
    activity_type,
    details,
    voucher_id,
    transaction_id,
    created_at
  ) VALUES (
    p_partner_id,
    'voucher_purchased',
    jsonb_build_object(
      'voucher_code', p_voucher_code,
      'voucher_amount', v_voucher_amount,
      'commission_amount', v_commission,
      'recipient_username', p_recipient_username,
      'recipient_email', p_recipient_email
    ),
    v_voucher_id,
    v_transaction_id,
    NOW()
  );

  RAISE NOTICE '[VOUCHER-ATOMIC] Activity logged successfully';
  RAISE NOTICE '[VOUCHER-ATOMIC] ========== ATOMIC OPERATION COMPLETE ==========';

  -- Return success with all details
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'voucher_id', v_voucher_id,
    'voucher_code', p_voucher_code,
    'old_balance', v_old_balance,
    'new_balance', v_new_balance,
    'amount_charged', v_amount,
    'commission_earned', v_commission,
    'total_vouchers_sold', v_total_vouchers_sold,
    'daily_sales', v_daily_sales,
    'new_rank', v_current_rank,
    'expires_at', (NOW() + INTERVAL '30 days')::TEXT
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '[VOUCHER-ATOMIC] ========== ERROR OCCURRED ==========';
    RAISE NOTICE '[VOUCHER-ATOMIC] Error: %', SQLERRM;
    RAISE NOTICE '[VOUCHER-ATOMIC] SQL State: %', SQLSTATE;
    
    -- Re-raise the exception to trigger rollback
    RAISE;
END;
$$;