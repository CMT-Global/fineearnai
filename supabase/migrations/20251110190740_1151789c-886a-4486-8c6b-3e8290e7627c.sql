-- Fix missing partner_paid_amount and commission_amount in purchase_voucher_atomic function
-- Phase 3: Add calculated values to voucher INSERT statement

CREATE OR REPLACE FUNCTION public.purchase_voucher_atomic(
  p_partner_id UUID,
  p_voucher_code TEXT,
  p_voucher_amount NUMERIC,
  p_commission_rate NUMERIC,
  p_notes TEXT DEFAULT NULL,
  p_recipient_username TEXT DEFAULT NULL,
  p_recipient_email TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_partner_balance NUMERIC;
  v_new_partner_balance NUMERIC;
  v_partner_transaction_id UUID;
  
  v_recipient_id UUID;
  v_recipient_username TEXT;
  v_recipient_balance NUMERIC;
  v_new_recipient_balance NUMERIC;
  v_recipient_transaction_id UUID;
  
  v_voucher_id UUID;
  v_voucher_amount NUMERIC;
  v_expires_at TIMESTAMP WITH TIME ZONE;
  
  -- Financial calculation variables
  v_commission NUMERIC;
  v_amount NUMERIC; -- This is partner_paid_amount
  
  v_result JSONB;
BEGIN
  -- Calculate financial values (lines 31-36 in original)
  v_voucher_amount := p_voucher_amount;
  v_commission := ROUND(p_voucher_amount * p_commission_rate, 2);
  v_amount := ROUND(p_voucher_amount - v_commission, 2);
  
  -- Set expiry date (30 days from now)
  v_expires_at := NOW() + INTERVAL '30 days';
  
  -- STEP 1: Validate and get recipient user
  IF p_recipient_username IS NOT NULL THEN
    SELECT id, username INTO v_recipient_id, v_recipient_username
    FROM profiles
    WHERE username = p_recipient_username
    LIMIT 1;
    
    IF v_recipient_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Recipient user not found',
        'error_code', 'INVALID_RECIPIENT'
      );
    END IF;
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Recipient username is required',
      'error_code', 'MISSING_RECIPIENT'
    );
  END IF;
  
  -- STEP 2: Lock partner profile and check balance
  SELECT deposit_wallet_balance INTO v_partner_balance
  FROM profiles
  WHERE id = p_partner_id
  FOR UPDATE;
  
  IF v_partner_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Partner profile not found',
      'error_code', 'PARTNER_NOT_FOUND'
    );
  END IF;
  
  IF v_partner_balance < v_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'error_code', 'INSUFFICIENT_BALANCE',
      'current_balance', v_partner_balance,
      'required_amount', v_amount
    );
  END IF;
  
  -- STEP 3: Calculate new partner balance
  v_new_partner_balance := v_partner_balance - v_amount;
  
  -- STEP 4: Lock recipient profile
  SELECT deposit_wallet_balance INTO v_recipient_balance
  FROM profiles
  WHERE id = v_recipient_id
  FOR UPDATE;
  
  IF v_recipient_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Recipient profile not found',
      'error_code', 'RECIPIENT_NOT_FOUND'
    );
  END IF;
  
  -- STEP 5: Calculate new recipient balance
  v_new_recipient_balance := v_recipient_balance + v_voucher_amount;
  
  -- STEP 6: Update partner balance
  UPDATE profiles
  SET 
    deposit_wallet_balance = v_new_partner_balance,
    last_activity = NOW()
  WHERE id = p_partner_id;
  
  -- STEP 7: Create partner transaction (debit)
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
    p_partner_id,
    'voucher_purchase',
    v_amount,
    'deposit',
    v_new_partner_balance,
    'completed',
    'Purchased voucher for ' || v_recipient_username,
    jsonb_build_object(
      'voucher_code', p_voucher_code,
      'voucher_amount', v_voucher_amount,
      'commission', v_commission,
      'commission_rate', p_commission_rate,
      'recipient_username', v_recipient_username,
      'recipient_id', v_recipient_id
    ),
    NOW()
  ) RETURNING id INTO v_partner_transaction_id;
  
  -- STEP 8: Update recipient balance
  UPDATE profiles
  SET 
    deposit_wallet_balance = v_new_recipient_balance,
    last_activity = NOW()
  WHERE id = v_recipient_id;
  
  -- STEP 9: Create recipient transaction (credit)
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
    v_recipient_id,
    'deposit',
    v_voucher_amount,
    'deposit',
    v_new_recipient_balance,
    'completed',
    'Voucher redemption from partner',
    jsonb_build_object(
      'voucher_code', p_voucher_code,
      'voucher_amount', v_voucher_amount,
      'source', 'voucher_auto_redemption',
      'purchase_transaction_id', v_partner_transaction_id
    ),
    NOW()
  ) RETURNING id INTO v_recipient_transaction_id;
  
  -- STEP 10: Create voucher record with ALL required columns including partner_paid_amount and commission_amount
  INSERT INTO public.vouchers (
    partner_id,
    voucher_code,
    voucher_amount,
    partner_paid_amount,      -- ✅ FIXED: Now included
    commission_amount,         -- ✅ FIXED: Now included
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
    v_amount,                  -- ✅ FIXED: Using v_amount (partner_paid_amount)
    v_commission,              -- ✅ FIXED: Using v_commission (commission_amount)
    p_commission_rate,
    'redeemed',
    p_notes,
    v_recipient_username,
    p_recipient_email,
    v_partner_transaction_id,
    v_recipient_id,
    NOW(),
    v_recipient_transaction_id,
    NOW(),
    v_expires_at
  ) RETURNING id INTO v_voucher_id;
  
  -- STEP 11: Update partner stats
  UPDATE partner_config
  SET 
    total_vouchers_sold = total_vouchers_sold + 1,
    daily_sales = daily_sales + v_amount,
    weekly_sales = weekly_sales + v_amount,
    total_commission_earned = total_commission_earned + v_commission,
    last_sale_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_partner_id;
  
  -- STEP 12: Return success result
  v_result := jsonb_build_object(
    'success', true,
    'voucher_id', v_voucher_id,
    'voucher_code', p_voucher_code,
    'voucher_amount', v_voucher_amount,
    'partner_paid_amount', v_amount,
    'commission_amount', v_commission,
    'partner_transaction_id', v_partner_transaction_id,
    'recipient_transaction_id', v_recipient_transaction_id,
    'partner_new_balance', v_new_partner_balance,
    'recipient_new_balance', v_new_recipient_balance,
    'recipient_username', v_recipient_username,
    'recipient_id', v_recipient_id,
    'auto_redeemed', true,
    'status', 'redeemed'
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