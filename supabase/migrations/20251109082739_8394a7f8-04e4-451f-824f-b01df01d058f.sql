-- Fix process_deposit_commission_simple_v1 function
-- Change earning_type from 'deposit' to 'deposit_commission' to match CHECK constraint

CREATE OR REPLACE FUNCTION public.process_deposit_commission_simple_v1(
  p_deposit_transaction_id uuid, 
  p_deposit_amount numeric, 
  p_depositor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_referral RECORD;
  v_upline_plan RECORD;
  v_commission_rate NUMERIC := 0;
  v_commission_amount NUMERIC := 0;
  v_new_upline_balance NUMERIC;
  v_commission_transaction_id UUID;
  v_referral_earning_id UUID;
  v_depositor_username TEXT;
BEGIN
  -- Step 1: Get depositor username for metadata
  SELECT username INTO v_depositor_username
  FROM profiles
  WHERE id = p_depositor_id;
  
  RAISE WARNING '[COMMISSION] Step 1: Processing deposit commission for user=%, deposit_tx=%', 
    v_depositor_username, p_deposit_transaction_id;
  
  -- Step 2: Check if depositor has active upline
  SELECT * INTO v_referral
  FROM referrals
  WHERE referred_id = p_depositor_id
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_referral.id IS NULL THEN
    RAISE WARNING '[COMMISSION] SKIPPED: No active upline found for user=%', v_depositor_username;
    RETURN jsonb_build_object(
      'success', true,
      'commission_amount', 0,
      'reason', 'no_upline',
      'message', 'User has no active upline'
    );
  END IF;
  
  RAISE WARNING '[COMMISSION] Step 2: Found upline referrer_id=%', v_referral.referrer_id;
  
  -- Step 3: Get upline's membership plan and commission rate
  SELECT 
    mp.name,
    mp.deposit_commission_rate,
    p.username
  INTO v_upline_plan
  FROM profiles p
  INNER JOIN membership_plans mp ON mp.name = p.membership_plan
  WHERE p.id = v_referral.referrer_id
    AND mp.is_active = true
  LIMIT 1;
  
  IF v_upline_plan.name IS NULL THEN
    RAISE WARNING '[COMMISSION] ERROR: Upline plan not found for referrer_id=%', v_referral.referrer_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'upline_plan_not_found',
      'error_code', 'PLAN_LOOKUP_FAILED'
    );
  END IF;
  
  v_commission_rate := v_upline_plan.deposit_commission_rate;
  
  RAISE WARNING '[COMMISSION] Step 3: Upline plan=%, rate=%', v_upline_plan.name, v_commission_rate;
  
  -- Step 4: Check if commission rate is valid
  IF v_commission_rate IS NULL OR v_commission_rate <= 0 THEN
    RAISE WARNING '[COMMISSION] SKIPPED: Commission rate is zero or negative (rate=%)', v_commission_rate;
    RETURN jsonb_build_object(
      'success', true,
      'commission_amount', 0,
      'reason', 'zero_rate',
      'message', 'Upline has zero commission rate'
    );
  END IF;
  
  -- Step 5: Calculate commission amount
  v_commission_amount := ROUND(p_deposit_amount * v_commission_rate, 4);
  
  RAISE WARNING '[COMMISSION] Step 4: Calculated commission=% (base=% × rate=%)', 
    v_commission_amount, p_deposit_amount, v_commission_rate;
  
  -- Step 6: Lock upline profile and credit commission
  SELECT earnings_wallet_balance INTO v_new_upline_balance
  FROM profiles
  WHERE id = v_referral.referrer_id
  FOR UPDATE;
  
  v_new_upline_balance := v_new_upline_balance + v_commission_amount;
  
  UPDATE profiles
  SET 
    earnings_wallet_balance = v_new_upline_balance,
    total_earned = total_earned + v_commission_amount,
    last_activity = NOW()
  WHERE id = v_referral.referrer_id;
  
  RAISE WARNING '[COMMISSION] Step 5: Credited upline, new_balance=%', v_new_upline_balance;
  
  -- Step 7: Create commission transaction
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
    v_referral.referrer_id,
    'referral_commission',
    v_commission_amount,
    'earnings',
    'completed',
    v_new_upline_balance,
    'Deposit commission from ' || v_depositor_username,
    jsonb_build_object(
      'source', 'deposit',
      'deposit_transaction_id', p_deposit_transaction_id,
      'depositor_id', p_depositor_id,
      'depositor_username', v_depositor_username,
      'base_amount', p_deposit_amount,
      'commission_rate', v_commission_rate,
      'processed_by', 'process_deposit_commission_simple_v1'
    ),
    NOW()
  ) RETURNING id INTO v_commission_transaction_id;
  
  RAISE WARNING '[COMMISSION] Step 6: Created commission transaction id=%', v_commission_transaction_id;
  
  -- Step 8: Create referral earning record with FIXED earning_type
  -- BUG FIX: Changed from 'deposit' to 'deposit_commission' to match CHECK constraint
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
    p_depositor_id,
    'deposit_commission',  -- FIXED: was 'deposit', now 'deposit_commission'
    p_deposit_amount,
    v_commission_rate,
    v_commission_amount,
    jsonb_build_object(
      'deposit_transaction_id', p_deposit_transaction_id,
      'commission_transaction_id', v_commission_transaction_id,
      'depositor_username', v_depositor_username,
      'upline_username', v_upline_plan.username
    ),
    NOW()
  ) RETURNING id INTO v_referral_earning_id;
  
  RAISE WARNING '[COMMISSION] Step 7: Created referral earning id=%', v_referral_earning_id;
  
  -- Step 9: Update referral stats
  UPDATE referrals
  SET 
    total_commission_earned = COALESCE(total_commission_earned, 0) + v_commission_amount,
    last_commission_at = NOW()
  WHERE id = v_referral.id;
  
  RAISE WARNING '[COMMISSION] SUCCESS: Processed commission=% for upline=%', 
    v_commission_amount, v_upline_plan.username;
  
  -- Step 10: Return success result
  RETURN jsonb_build_object(
    'success', true,
    'commission_amount', v_commission_amount,
    'commission_rate', v_commission_rate,
    'commission_transaction_id', v_commission_transaction_id,
    'referral_earning_id', v_referral_earning_id,
    'upline_id', v_referral.referrer_id,
    'upline_username', v_upline_plan.username,
    'upline_new_balance', v_new_upline_balance
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Fail gracefully - return error details
  RAISE WARNING '[COMMISSION] ERROR: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'error_code', SQLSTATE,
    'deposit_transaction_id', p_deposit_transaction_id,
    'depositor_id', p_depositor_id
  );
END;
$function$;