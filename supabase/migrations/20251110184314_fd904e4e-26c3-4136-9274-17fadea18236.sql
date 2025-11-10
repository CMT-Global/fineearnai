-- Phase 1: Auto-Redeem Vouchers on Purchase
-- Modify purchase_voucher_atomic to instantly credit recipient and mark voucher as redeemed

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
  v_partner_transaction_id UUID;
  v_recipient_transaction_id UUID;
  v_partner_old_balance NUMERIC;
  v_partner_new_balance NUMERIC;
  v_partner_current_balance NUMERIC;
  v_recipient_id UUID;
  v_recipient_old_balance NUMERIC;
  v_recipient_new_balance NUMERIC;
  v_recipient_username TEXT;
  v_amount NUMERIC;
  v_commission NUMERIC;
  v_voucher_amount NUMERIC;
  v_total_vouchers_sold INT;
  v_daily_sales NUMERIC;
  v_current_rank TEXT;
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  RAISE NOTICE '[VOUCHER-ATOMIC] Starting atomic voucher purchase with auto-redemption';
  RAISE NOTICE '[VOUCHER-ATOMIC] Partner: %, Code: %, Amount: %, Recipient: %', 
    p_partner_id, p_voucher_code, p_voucher_amount, p_recipient_username;

  -- Apply explicit rounding to all monetary inputs
  v_amount := ROUND(p_partner_paid_amount, 2);
  v_commission := ROUND(p_commission_amount, 2);
  v_voucher_amount := ROUND(p_voucher_amount, 2);

  RAISE NOTICE '[VOUCHER-ATOMIC] Rounded amounts - Partner Paid: %, Commission: %, Voucher: %', 
    v_amount, v_commission, v_voucher_amount;

  -- ============================================================================
  -- Step 1: Validate and lookup recipient by username
  -- ============================================================================
  IF p_recipient_username IS NULL OR TRIM(p_recipient_username) = '' THEN
    RAISE NOTICE '[VOUCHER-ATOMIC] ERROR: Recipient username is required';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Recipient username is required',
      'error_code', 'RECIPIENT_REQUIRED'
    );
  END IF;

  -- Lookup recipient profile
  SELECT id, username INTO v_recipient_id, v_recipient_username
  FROM public.profiles
  WHERE username = TRIM(p_recipient_username)
  LIMIT 1;

  IF v_recipient_id IS NULL THEN
    RAISE NOTICE '[VOUCHER-ATOMIC] ERROR: Recipient username not found: %', p_recipient_username;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Recipient username not found',
      'error_code', 'RECIPIENT_NOT_FOUND',
      'recipient_username', p_recipient_username
    );
  END IF;

  -- Prevent sending to self
  IF v_recipient_id = p_partner_id THEN
    RAISE NOTICE '[VOUCHER-ATOMIC] ERROR: Cannot send voucher to yourself';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot send voucher to yourself',
      'error_code', 'SELF_TRANSFER_NOT_ALLOWED'
    );
  END IF;

  RAISE NOTICE '[VOUCHER-ATOMIC] Recipient validated: % (ID: %)', v_recipient_username, v_recipient_id;

  -- ============================================================================
  -- Step 2: Lock BOTH profiles atomically (partner first, then recipient)
  -- ============================================================================
  -- Lock partner profile
  SELECT deposit_wallet_balance INTO v_partner_current_balance
  FROM public.profiles
  WHERE id = p_partner_id
  FOR UPDATE;

  IF v_partner_current_balance IS NULL THEN
    RAISE EXCEPTION 'Partner profile not found';
  END IF;

  v_partner_old_balance := v_partner_current_balance;
  RAISE NOTICE '[VOUCHER-ATOMIC] Partner balance locked: %', v_partner_current_balance;

  -- Lock recipient profile
  SELECT deposit_wallet_balance INTO v_recipient_old_balance
  FROM public.profiles
  WHERE id = v_recipient_id
  FOR UPDATE;

  IF v_recipient_old_balance IS NULL THEN
    RAISE EXCEPTION 'Recipient profile not found';
  END IF;

  RAISE NOTICE '[VOUCHER-ATOMIC] Recipient balance locked: %', v_recipient_old_balance;

  -- ============================================================================
  -- Step 3: Validate partner has sufficient balance
  -- ============================================================================
  IF v_partner_current_balance < v_amount THEN
    RAISE NOTICE '[VOUCHER-ATOMIC] Insufficient balance: % < %', v_partner_current_balance, v_amount;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient deposit wallet balance',
      'error_code', 'INSUFFICIENT_BALANCE',
      'current_balance', v_partner_current_balance,
      'required_amount', v_amount
    );
  END IF;

  -- ============================================================================
  -- Step 4: Calculate new balances with explicit rounding
  -- ============================================================================
  v_partner_new_balance := ROUND(v_partner_current_balance - v_amount, 2);
  v_recipient_new_balance := ROUND(v_recipient_old_balance + v_voucher_amount, 2);
  
  RAISE NOTICE '[VOUCHER-ATOMIC] Partner balance: % -> %', v_partner_old_balance, v_partner_new_balance;
  RAISE NOTICE '[VOUCHER-ATOMIC] Recipient balance: % -> %', v_recipient_old_balance, v_recipient_new_balance;

  -- ============================================================================
  -- Step 5: Insert PARTNER transaction (debit)
  -- ============================================================================
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
    'voucher_purchase',
    v_amount,
    'deposit',
    v_partner_new_balance,
    'completed',
    'Voucher sent to @' || v_recipient_username,
    'internal',
    jsonb_build_object(
      'voucher_code', p_voucher_code,
      'voucher_amount', v_voucher_amount,
      'commission_amount', v_commission,
      'commission_rate', p_commission_rate,
      'recipient_id', v_recipient_id,
      'recipient_username', v_recipient_username,
      'recipient_email', p_recipient_email,
      'notes', p_notes,
      'auto_redeemed', true
    ),
    NOW()
  ) RETURNING id INTO v_partner_transaction_id;

  RAISE NOTICE '[VOUCHER-ATOMIC] Partner transaction inserted: %', v_partner_transaction_id;

  -- ============================================================================
  -- Step 6: Insert RECIPIENT transaction (credit)
  -- ============================================================================
  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    wallet_type,
    new_balance,
    status,
    description,
    payment_gateway,
    gateway_transaction_id,
    metadata,
    created_at
  ) VALUES (
    v_recipient_id,
    'deposit',
    v_voucher_amount,
    'deposit',
    v_recipient_new_balance,
    'completed',
    'Voucher from Partner @' || (SELECT username FROM public.profiles WHERE id = p_partner_id LIMIT 1),
    'voucher',
    p_voucher_code,
    jsonb_build_object(
      'voucher_code', p_voucher_code,
      'voucher_amount', v_voucher_amount,
      'partner_id', p_partner_id,
      'source', 'partner_voucher',
      'auto_redeemed', true
    ),
    NOW()
  ) RETURNING id INTO v_recipient_transaction_id;

  RAISE NOTICE '[VOUCHER-ATOMIC] Recipient transaction inserted: %', v_recipient_transaction_id;

  -- ============================================================================
  -- Step 7: Update PARTNER profile balance
  -- ============================================================================
  UPDATE public.profiles
  SET 
    deposit_wallet_balance = v_partner_new_balance,
    last_activity = NOW()
  WHERE id = p_partner_id;

  RAISE NOTICE '[VOUCHER-ATOMIC] Partner profile updated to balance: %', v_partner_new_balance;

  -- ============================================================================
  -- Step 8: Update RECIPIENT profile balance
  -- ============================================================================
  UPDATE public.profiles
  SET 
    deposit_wallet_balance = v_recipient_new_balance,
    last_activity = NOW()
  WHERE id = v_recipient_id;

  RAISE NOTICE '[VOUCHER-ATOMIC] Recipient profile updated to balance: %', v_recipient_new_balance;

  -- ============================================================================
  -- Step 9: Create voucher with status='redeemed' (already redeemed)
  -- ============================================================================
  v_expires_at := NOW() + INTERVAL '30 days';
  
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
    redeemed_by_user_id,
    redeemed_at,
    redemption_transaction_id,
    created_at,
    expires_at
  ) VALUES (
    p_partner_id,
    p_voucher_code,
    v_voucher_amount,
    p_commission_rate,
    'redeemed',  -- ✅ Already redeemed
    p_notes,
    v_recipient_username,
    p_recipient_email,
    v_partner_transaction_id,
    v_recipient_id,  -- ✅ Set immediately
    NOW(),  -- ✅ Redeemed now
    v_recipient_transaction_id,  -- ✅ Link to recipient transaction
    NOW(),
    v_expires_at
  ) RETURNING id INTO v_voucher_id;

  RAISE NOTICE '[VOUCHER-ATOMIC] Voucher created as REDEEMED: %', v_voucher_id;

  -- ============================================================================
  -- Step 10: Update partner stats
  -- ============================================================================
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

  -- ============================================================================
  -- Step 11: Log activity
  -- ============================================================================
  INSERT INTO public.partner_activity_log (
    partner_id,
    activity_type,
    details,
    voucher_id,
    transaction_id,
    created_at
  ) VALUES (
    p_partner_id,
    'voucher_purchased_and_redeemed',
    jsonb_build_object(
      'voucher_code', p_voucher_code,
      'voucher_amount', v_voucher_amount,
      'commission_amount', v_commission,
      'recipient_id', v_recipient_id,
      'recipient_username', v_recipient_username,
      'recipient_email', p_recipient_email,
      'auto_redeemed', true,
      'partner_transaction_id', v_partner_transaction_id,
      'recipient_transaction_id', v_recipient_transaction_id
    ),
    v_voucher_id,
    v_partner_transaction_id,
    NOW()
  );

  RAISE NOTICE '[VOUCHER-ATOMIC] Activity logged successfully';
  RAISE NOTICE '[VOUCHER-ATOMIC] ========== ATOMIC OPERATION COMPLETE (AUTO-REDEEMED) ==========';

  -- ============================================================================
  -- Step 12: Return success with BOTH transaction details
  -- ============================================================================
  RETURN jsonb_build_object(
    'success', true,
    'partner_transaction_id', v_partner_transaction_id,
    'recipient_transaction_id', v_recipient_transaction_id,
    'voucher_id', v_voucher_id,
    'voucher_code', p_voucher_code,
    'partner_old_balance', v_partner_old_balance,
    'partner_new_balance', v_partner_new_balance,
    'recipient_old_balance', v_recipient_old_balance,
    'recipient_new_balance', v_recipient_new_balance,
    'amount_charged', v_amount,
    'commission_earned', v_commission,
    'voucher_amount', v_voucher_amount,
    'recipient_id', v_recipient_id,
    'recipient_username', v_recipient_username,
    'recipient_credited', true,
    'auto_redeemed', true,
    'redeemed_at', NOW(),
    'total_vouchers_sold', v_total_vouchers_sold,
    'daily_sales', v_daily_sales,
    'new_rank', v_current_rank,
    'expires_at', v_expires_at::TEXT,
    'old_balance', v_partner_old_balance,
    'new_balance', v_partner_new_balance
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