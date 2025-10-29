-- Phase 4: Create process_plan_upgrade_atomic function
-- This function processes plan upgrades with instant referral commission in a single atomic transaction

CREATE OR REPLACE FUNCTION public.process_plan_upgrade_atomic(
  p_user_id UUID,
  p_plan_name TEXT,
  p_final_cost NUMERIC,
  p_expiry_date TIMESTAMP WITH TIME ZONE,
  p_previous_plan TEXT DEFAULT 'free',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_deposit_balance NUMERIC;
  v_new_deposit_balance NUMERIC;
  v_transaction_id UUID;
  v_referral RECORD;
  v_referrer_plan RECORD;
  v_commission_amount NUMERIC := 0;
  v_commission_transaction_id UUID;
  v_referral_earning_id UUID;
  v_new_referrer_balance NUMERIC;
  v_commission_rate NUMERIC := 0;
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
  
  -- Step 6: Process referral commission if applicable
  -- Get referral relationship
  SELECT * INTO v_referral
  FROM referrals
  WHERE referred_id = p_user_id
  AND status = 'active'
  LIMIT 1;
  
  IF v_referral IS NOT NULL THEN
    -- Get referrer's membership plan details
    SELECT mp.* INTO v_referrer_plan
    FROM profiles p
    INNER JOIN membership_plans mp ON mp.name = p.membership_plan
    WHERE p.id = v_referral.referrer_id
    AND mp.is_active = true;
    
    IF v_referrer_plan IS NOT NULL THEN
      v_commission_rate := v_referrer_plan.deposit_commission_rate;
      
      -- Calculate commission (deposit commission rate on upgrade cost)
      IF v_commission_rate > 0 THEN
        v_commission_amount := ROUND(p_final_cost * v_commission_rate, 4);
        
        -- Lock referrer's profile and get current balance
        SELECT earnings_wallet_balance INTO v_new_referrer_balance
        FROM profiles
        WHERE id = v_referral.referrer_id
        FOR UPDATE;
        
        -- Update referrer's balance
        v_new_referrer_balance := v_new_referrer_balance + v_commission_amount;
        
        UPDATE profiles
        SET
          earnings_wallet_balance = v_new_referrer_balance,
          total_earned = total_earned + v_commission_amount,
          last_activity = NOW()
        WHERE id = v_referral.referrer_id;
        
        -- Create commission transaction for referrer
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
          v_referral.referrer_id,
          'referral_commission',
          v_commission_amount,
          'earnings',
          v_new_referrer_balance,
          'completed',
          'Referral commission from plan upgrade',
          jsonb_build_object(
            'source_event', 'plan_upgrade',
            'referred_user_id', p_user_id,
            'base_amount', p_final_cost,
            'commission_rate', v_commission_rate,
            'plan_name', p_plan_name,
            'transaction_id', v_transaction_id,
            'processed_atomically', true
          ),
          NOW()
        ) RETURNING id INTO v_commission_transaction_id;
        
        -- Create referral_earnings record
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
          p_user_id,
          'plan_upgrade',
          p_final_cost,
          v_commission_rate,
          v_commission_amount,
          jsonb_build_object(
            'plan_name', p_plan_name,
            'transaction_id', v_transaction_id,
            'commission_transaction_id', v_commission_transaction_id,
            'processed_atomically', true
          ),
          NOW()
        ) RETURNING id INTO v_referral_earning_id;
        
        -- Update referral total commission
        UPDATE referrals
        SET
          total_commission_earned = total_commission_earned + v_commission_amount,
          last_commission_date = NOW()
        WHERE id = v_referral.id;
        
        RAISE NOTICE 'Commission processed: referrer=%, amount=%', v_referral.referrer_id, v_commission_amount;
      END IF;
    END IF;
  END IF;
  
  -- Step 7: Return success result
  v_result := jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'old_deposit_balance', v_current_deposit_balance,
    'new_deposit_balance', v_new_deposit_balance,
    'amount_charged', p_final_cost,
    'plan_name', p_plan_name,
    'expires_at', p_expiry_date,
    'commission_processed', v_commission_amount > 0,
    'commission_amount', v_commission_amount,
    'commission_transaction_id', v_commission_transaction_id,
    'referral_earning_id', v_referral_earning_id
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
$$;