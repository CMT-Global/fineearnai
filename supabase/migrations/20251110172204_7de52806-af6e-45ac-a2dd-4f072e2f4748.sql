-- Create atomic voucher purchase function
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
) RETURNS JSONB AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
  v_voucher_id UUID;
  v_new_rank TEXT;
  v_partner_config RECORD;
  v_voucher_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Step 1: Lock partner profile and get current balance
  SELECT deposit_wallet_balance INTO v_current_balance
  FROM public.profiles
  WHERE id = p_partner_id
  FOR UPDATE;
  
  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Partner profile not found',
      'error_code', 'PROFILE_NOT_FOUND'
    );
  END IF;
  
  -- Step 2: Validate sufficient balance
  IF v_current_balance < p_partner_paid_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient deposit wallet balance',
      'error_code', 'INSUFFICIENT_BALANCE',
      'current_balance', v_current_balance,
      'required_amount', p_partner_paid_amount
    );
  END IF;
  
  -- Step 3: Get partner config (locked for update)
  SELECT * INTO v_partner_config
  FROM public.partner_config
  WHERE user_id = p_partner_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Partner configuration not found',
      'error_code', 'CONFIG_NOT_FOUND'
    );
  END IF;
  
  IF NOT v_partner_config.is_active THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Partner account is not active',
      'error_code', 'PARTNER_INACTIVE'
    );
  END IF;
  
  -- Step 4: Calculate new balance
  v_new_balance := v_current_balance - p_partner_paid_amount;
  
  RAISE NOTICE '[VOUCHER-ATOMIC] Partner: %, Amount: %, Old Balance: %, New Balance: %', 
    p_partner_id, p_partner_paid_amount, v_current_balance, v_new_balance;
  
  -- Step 5: Update partner balance
  UPDATE public.profiles
  SET 
    deposit_wallet_balance = v_new_balance,
    last_activity = NOW()
  WHERE id = p_partner_id;
  
  -- Step 6: Create transaction record
  INSERT INTO public.transactions (
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
    'transfer',
    p_partner_paid_amount,
    'deposit',
    v_new_balance,
    'completed',
    'Purchased voucher code: ' || p_voucher_code,
    jsonb_build_object(
      'voucher_code', p_voucher_code,
      'voucher_amount', p_voucher_amount,
      'commission_amount', p_commission_amount,
      'commission_rate', p_commission_rate,
      'recipient_username', p_recipient_username,
      'recipient_email', p_recipient_email,
      'processed_by', 'purchase_voucher_atomic'
    ),
    NOW()
  ) RETURNING id INTO v_transaction_id;
  
  RAISE NOTICE '[VOUCHER-ATOMIC] Transaction created: %', v_transaction_id;
  
  -- Step 7: Create voucher record
  v_voucher_expires_at := NOW() + INTERVAL '30 days';
  
  INSERT INTO public.vouchers (
    voucher_code,
    partner_id,
    voucher_amount,
    partner_paid_amount,
    commission_amount,
    commission_rate,
    status,
    expires_at,
    purchase_transaction_id,
    notes,
    created_at
  ) VALUES (
    p_voucher_code,
    p_partner_id,
    p_voucher_amount,
    p_partner_paid_amount,
    p_commission_amount,
    p_commission_rate,
    'active',
    v_voucher_expires_at,
    v_transaction_id,
    p_notes,
    NOW()
  ) RETURNING id INTO v_voucher_id;
  
  RAISE NOTICE '[VOUCHER-ATOMIC] Voucher created: %', v_voucher_id;
  
  -- Step 8: Update partner stats
  UPDATE public.partner_config
  SET 
    total_vouchers_sold = total_vouchers_sold + 1,
    total_commission_earned = total_commission_earned + p_commission_amount,
    daily_sales = daily_sales + p_voucher_amount,
    weekly_sales = weekly_sales + p_voucher_amount,
    last_sale_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_partner_id;
  
  RAISE NOTICE '[VOUCHER-ATOMIC] Partner stats updated';
  
  -- Step 9: Update partner rank
  SELECT update_partner_rank(p_partner_id) INTO v_new_rank;
  
  RAISE NOTICE '[VOUCHER-ATOMIC] Partner rank updated to: %', v_new_rank;
  
  -- Step 10: Log activity
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
      'voucher_amount', p_voucher_amount,
      'commission_amount', p_commission_amount,
      'recipient_username', p_recipient_username,
      'recipient_email', p_recipient_email
    ),
    v_voucher_id,
    v_transaction_id,
    NOW()
  );
  
  RAISE NOTICE '[VOUCHER-ATOMIC] SUCCESS: Voucher purchase complete';
  
  -- Step 11: Return success result
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'voucher_id', v_voucher_id,
    'voucher_code', p_voucher_code,
    'old_balance', v_current_balance,
    'new_balance', v_new_balance,
    'amount_charged', p_partner_paid_amount,
    'commission_earned', p_commission_amount,
    'expires_at', v_voucher_expires_at,
    'new_rank', v_new_rank,
    'total_vouchers_sold', v_partner_config.total_vouchers_sold + 1,
    'daily_sales', v_partner_config.daily_sales + p_voucher_amount
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Automatic rollback on any error
  RAISE WARNING '[VOUCHER-ATOMIC] ERROR: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'error_code', SQLSTATE,
    'sql_state', SQLSTATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;