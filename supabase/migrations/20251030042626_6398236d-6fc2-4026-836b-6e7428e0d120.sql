-- Fix credit_deposit_atomic function: Remove brittle plan lookup condition
-- Phase 1+2: Fix plan lookup and add failure logging

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
  v_referred_username TEXT;
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
  
  -- Step 2: Lock user's profile and get current balance + username
  SELECT deposit_wallet_balance, username INTO v_current_balance, v_referred_username
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
  
  RAISE NOTICE '[DEPOSIT] Profile locked: old_balance=%, username=%', v_current_balance, v_referred_username;
  
  -- Step 3: Calculate new balance
  v_new_balance := v_current_balance + p_amount;
  RAISE NOTICE '[DEPOSIT] Balance calculation: old=%, amount=%, new=%', v_current_balance, p_amount, v_new_balance;
  
  -- Step 4: Insert transaction record
  INSERT INTO transactions (
    user_id, type, amount, wallet_type, new_balance, description, status,
    payment_gateway, gateway_transaction_id, metadata, created_at
  ) VALUES (
    p_user_id, 'deposit', p_amount, 'deposit', v_new_balance,
    'Deposit via ' || p_payment_method, 'completed',
    p_payment_method, p_order_id, p_metadata, NOW()
  ) RETURNING id INTO v_transaction_id;
  
  RAISE NOTICE '[DEPOSIT] Transaction created: id=%', v_transaction_id;
  
  -- Step 5: Update profile balance atomically
  UPDATE profiles
  SET deposit_wallet_balance = v_new_balance, last_activity = NOW()
  WHERE id = p_user_id;
  
  RAISE NOTICE '[DEPOSIT] Profile updated: new_balance=%', v_new_balance;
  
  -- Step 6: Process Referral Commission
  RAISE NOTICE '[COMMISSION] Starting commission check for deposit user=%', p_user_id;
  
  -- PHASE 1 FIX: Add deterministic ORDER BY to referral selection
  SELECT * INTO v_referral FROM referrals
  WHERE referred_id = p_user_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_referral IS NOT NULL THEN
    RAISE NOTICE '[COMMISSION] Active referral found: referrer=%, referred=%', v_referral.referrer_id, v_referral.referred_id;
    
    -- PHASE 1 FIX: Remove mp.is_active = true condition and use explicit column selection
    SELECT mp.name, mp.deposit_commission_rate, mp.task_commission_rate
    INTO v_referrer_plan
    FROM profiles p
    INNER JOIN membership_plans mp ON mp.name = p.membership_plan
    WHERE p.id = v_referral.referrer_id
    LIMIT 1;
    
    -- PHASE 2: Add failure logging if plan lookup fails
    IF v_referrer_plan IS NULL THEN
      RAISE NOTICE '[COMMISSION] CRITICAL: Plan lookup failed for referrer=%, profile.membership_plan=%', 
        v_referral.referrer_id, 
        (SELECT membership_plan FROM profiles WHERE id = v_referral.referrer_id);
    END IF;
    
    IF v_referrer_plan IS NOT NULL THEN
      v_commission_rate := v_referrer_plan.deposit_commission_rate;
      RAISE NOTICE '[COMMISSION] Referrer plan: name=%, deposit_commission_rate=%', v_referrer_plan.name, v_commission_rate;
      
      IF v_commission_rate > 0 THEN
        v_commission_amount := ROUND(p_amount * v_commission_rate, 4);
        RAISE NOTICE '[COMMISSION] Commission calculated: base=%, rate=%, amount=%', p_amount, v_commission_rate, v_commission_amount;
        
        SELECT earnings_wallet_balance INTO v_new_referrer_balance
        FROM profiles WHERE id = v_referral.referrer_id FOR UPDATE;
        
        RAISE NOTICE '[COMMISSION] Referrer locked: old_balance=%', v_new_referrer_balance;
        
        v_new_referrer_balance := v_new_referrer_balance + v_commission_amount;
        
        UPDATE profiles
        SET earnings_wallet_balance = v_new_referrer_balance,
            total_earned = total_earned + v_commission_amount,
            last_activity = NOW()
        WHERE id = v_referral.referrer_id;
        
        RAISE NOTICE '[COMMISSION] Referrer balance updated: new_balance=%', v_new_referrer_balance;
        
        INSERT INTO transactions (
          user_id, type, amount, wallet_type, new_balance, status, description, metadata, created_at
        ) VALUES (
          v_referral.referrer_id, 'referral_commission', v_commission_amount, 'earnings',
          v_new_referrer_balance, 'completed',
          'Referral commission from deposit: ' || v_referred_username,
          jsonb_build_object(
            'source_event', 'deposit',
            'referred_user_id', p_user_id,
            'referred_username', v_referred_username,
            'base_amount', p_amount,
            'commission_rate', v_commission_rate,
            'transaction_id', v_transaction_id,
            'processed_atomically', true
          ), NOW()
        ) RETURNING id INTO v_commission_transaction_id;
        
        RAISE NOTICE '[COMMISSION] Commission transaction created: id=%', v_commission_transaction_id;
        
        INSERT INTO referral_earnings (
          referrer_id, referred_user_id, earning_type, base_amount,
          commission_rate, commission_amount, metadata, created_at
        ) VALUES (
          v_referral.referrer_id, p_user_id, 'deposit_commission', p_amount,
          v_commission_rate, v_commission_amount,
          jsonb_build_object(
            'referred_username', v_referred_username,
            'transaction_id', v_transaction_id,
            'commission_transaction_id', v_commission_transaction_id,
            'processed_atomically', true
          ), NOW()
        ) RETURNING id INTO v_referral_earning_id;
        
        RAISE NOTICE '[COMMISSION] Referral earning created: id=%', v_referral_earning_id;
        
        UPDATE referrals
        SET total_commission_earned = total_commission_earned + v_commission_amount,
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