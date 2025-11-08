-- Phase 1: Simplify Deposit Commission Logic
-- Remove account_type and referral_eligible checks
-- ANY user's deposit triggers commission for their upline if upline has deposit_commission_rate > 0

CREATE OR REPLACE FUNCTION public.credit_deposit_atomic_v2(
  p_user_id uuid, 
  p_amount numeric, 
  p_tracking_id text, 
  p_payment_id text, 
  p_payment_method text DEFAULT 'cpay'::text, 
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
  v_referred_username TEXT;
BEGIN
  -- Input validation
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be null';
  END IF;
  
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  RAISE NOTICE '[DEPOSIT] Starting atomic deposit: user=%, amount=%, tracking=%', p_user_id, p_amount, p_tracking_id;

  -- Check for duplicate transaction using tracking_id
  IF p_tracking_id IS NOT NULL THEN
    SELECT id INTO v_existing_tx 
    FROM transactions 
    WHERE user_id = p_user_id 
      AND type = 'deposit' 
      AND metadata->>'tracking_id' = p_tracking_id
    LIMIT 1;
    
    IF v_existing_tx IS NOT NULL THEN
      RAISE NOTICE '[DEPOSIT] Duplicate transaction detected for tracking_id=%', p_tracking_id;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'duplicate_transaction',
        'message', 'This deposit has already been processed',
        'existing_transaction_id', v_existing_tx
      );
    END IF;
  END IF;

  -- Get current balance with row lock
  SELECT deposit_wallet_balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Calculate new balance
  v_new_balance := v_current_balance + p_amount;
  
  RAISE NOTICE '[DEPOSIT] Current balance=%, New balance=%', v_current_balance, v_new_balance;

  -- Update profile balance
  UPDATE profiles
  SET 
    deposit_wallet_balance = v_new_balance,
    last_activity = NOW()
  WHERE id = p_user_id;

  -- Create deposit transaction
  INSERT INTO transactions (
    user_id,
    type,
    amount,
    wallet_type,
    status,
    payment_gateway,
    gateway_transaction_id,
    new_balance_after_transaction,
    metadata
  ) VALUES (
    p_user_id,
    'deposit',
    p_amount,
    'deposit',
    'completed',
    p_payment_method,
    p_payment_id,
    v_new_balance,
    jsonb_build_object(
      'tracking_id', p_tracking_id,
      'payment_method', p_payment_method,
      'payment_id', p_payment_id,
      'additional_data', p_metadata
    )
  ) RETURNING id INTO v_transaction_id;

  RAISE NOTICE '[DEPOSIT] Transaction created: id=%', v_transaction_id;

  -- ========================================
  -- SIMPLIFIED COMMISSION PROCESSING
  -- ========================================
  RAISE NOTICE '[COMMISSION] Starting deposit commission check for user=%', p_user_id;
  
  -- Get active referral (if exists)
  SELECT * INTO v_referral 
  FROM referrals
  WHERE referred_id = p_user_id 
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_referral IS NOT NULL THEN
    RAISE NOTICE '[COMMISSION] Active upline found: referrer=%', v_referral.referrer_id;
    
    -- Get upline's deposit commission rate
    SELECT 
      mp.name, 
      mp.deposit_commission_rate,
      p.username
    INTO v_referrer_plan
    FROM profiles p
    INNER JOIN membership_plans mp ON mp.name = p.membership_plan
    WHERE p.id = v_referral.referrer_id 
      AND mp.is_active = true
    LIMIT 1;
    
    IF v_referrer_plan.name IS NULL THEN
      RAISE NOTICE '[COMMISSION] SKIPPED: Plan lookup failed for referrer=%', v_referral.referrer_id;
    ELSIF v_referrer_plan.deposit_commission_rate IS NULL OR v_referrer_plan.deposit_commission_rate <= 0 THEN
      RAISE NOTICE '[COMMISSION] SKIPPED: Deposit commission rate is zero or negative (rate=%)', v_referrer_plan.deposit_commission_rate;
    ELSE
      -- Process commission
      v_commission_rate := v_referrer_plan.deposit_commission_rate;
      v_commission_amount := ROUND(p_amount * v_commission_rate, 4);
      
      RAISE NOTICE '[COMMISSION] Processing: rate=%, amount=%', v_commission_rate, v_commission_amount;
      
      -- Get referred user's username
      SELECT username INTO v_referred_username
      FROM profiles
      WHERE id = p_user_id;
      
      -- Credit commission to upline's earnings wallet
      UPDATE profiles
      SET 
        earnings_wallet_balance = earnings_wallet_balance + v_commission_amount,
        total_earned = total_earned + v_commission_amount,
        last_activity = NOW()
      WHERE id = v_referral.referrer_id
      RETURNING earnings_wallet_balance INTO v_new_referrer_balance;
      
      -- Create commission transaction for upline
      INSERT INTO transactions (
        user_id,
        type,
        amount,
        wallet_type,
        status,
        new_balance_after_transaction,
        metadata
      ) VALUES (
        v_referral.referrer_id,
        'deposit_commission',
        v_commission_amount,
        'earnings',
        'completed',
        v_new_referrer_balance,
        jsonb_build_object(
          'commission_rate', v_commission_rate,
          'base_amount', p_amount,
          'referred_user_id', p_user_id,
          'referred_username', v_referred_username,
          'deposit_transaction_id', v_transaction_id,
          'source', 'deposit'
        )
      ) RETURNING id INTO v_commission_transaction_id;
      
      -- Create referral earning record
      INSERT INTO referral_earnings (
        referrer_id,
        referred_user_id,
        earning_type,
        base_amount,
        commission_rate,
        commission_amount,
        metadata
      ) VALUES (
        v_referral.referrer_id,
        p_user_id,
        'deposit',
        p_amount,
        v_commission_rate,
        v_commission_amount,
        jsonb_build_object(
          'deposit_transaction_id', v_transaction_id,
          'commission_transaction_id', v_commission_transaction_id,
          'referred_username', v_referred_username
        )
      ) RETURNING id INTO v_referral_earning_id;
      
      -- Update referral stats
      UPDATE referrals
      SET 
        total_commission_earned = COALESCE(total_commission_earned, 0) + v_commission_amount,
        last_commission_at = NOW()
      WHERE id = v_referral.id;
      
      RAISE NOTICE '[COMMISSION] SUCCESS: Credited % to referrer (tx=%, earning=%)', 
        v_commission_amount, v_commission_transaction_id, v_referral_earning_id;
    END IF;
  ELSE
    RAISE NOTICE '[COMMISSION] SKIPPED: No active upline found';
  END IF;

  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'new_balance', v_new_balance,
    'amount_credited', p_amount,
    'commission_processed', v_commission_amount > 0,
    'commission_amount', v_commission_amount,
    'commission_transaction_id', v_commission_transaction_id,
    'referral_earning_id', v_referral_earning_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[DEPOSIT] ERROR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$function$;