-- Update credit_deposit_atomic_v2 to fix deposit commission logic
-- Key changes:
-- 1. Remove referral_eligible check for deposit commissions
-- 2. Always use referrer's deposit_commission_rate
-- 3. Allow free plans to give and receive deposit commissions

CREATE OR REPLACE FUNCTION public.credit_deposit_atomic_v2(
  p_user_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_gateway_transaction_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance NUMERIC;
  v_transaction_id UUID;
  v_referrer_id UUID;
  v_referrer_plan RECORD;
  v_commission_amount NUMERIC;
  v_commission_transaction_id UUID;
  v_referral_earning_id UUID;
  v_audit_log_id UUID;
  v_result JSONB;
BEGIN
  -- Check for duplicate transaction
  IF EXISTS (
    SELECT 1 FROM transactions 
    WHERE gateway_transaction_id = p_gateway_transaction_id
    AND status = 'completed'
  ) THEN
    RAISE NOTICE '[DIAG] Duplicate transaction detected: %', p_gateway_transaction_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'duplicate_transaction',
      'message', 'Transaction already processed'
    );
  END IF;

  -- 1. Credit user's deposit wallet atomically
  UPDATE profiles
  SET 
    deposit_wallet_balance = deposit_wallet_balance + p_amount,
    last_activity = NOW()
  WHERE id = p_user_id
  RETURNING deposit_wallet_balance INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  RAISE NOTICE '[DIAG-1] User deposit wallet credited. New balance: %', v_new_balance;

  -- 2. Create deposit transaction
  INSERT INTO transactions (
    user_id,
    type,
    amount,
    wallet_type,
    status,
    payment_gateway,
    gateway_transaction_id,
    new_balance_after_transaction
  ) VALUES (
    p_user_id,
    'deposit',
    p_amount,
    'deposit',
    'completed',
    p_payment_method,
    p_gateway_transaction_id,
    v_new_balance
  )
  RETURNING id INTO v_transaction_id;

  RAISE NOTICE '[DIAG-2] Deposit transaction created. ID: %', v_transaction_id;

  -- 3. Process referral commission for deposit
  -- CRITICAL FIX: Check referrer's plan, not depositor's plan
  -- Get active referral relationship
  SELECT referrer_id INTO v_referrer_id
  FROM referrals
  WHERE referred_id = p_user_id
    AND status = 'active'
  LIMIT 1;

  IF v_referrer_id IS NOT NULL THEN
    RAISE NOTICE '[DIAG-3] Active referral found. Referrer: %', v_referrer_id;

    -- Get referrer's membership plan details
    -- THIS IS THE KEY FIX: We fetch the REFERRER's plan, not the depositor's plan
    SELECT 
      mp.deposit_commission_rate,
      mp.name as plan_name,
      mp.account_type
    INTO v_referrer_plan
    FROM profiles p
    JOIN membership_plans mp ON p.membership_plan = mp.name
    WHERE p.id = v_referrer_id
      AND mp.is_active = true;

    IF FOUND THEN
      RAISE NOTICE '[DIAG-4] Referrer plan found: %, deposit_commission_rate: %', 
        v_referrer_plan.plan_name, v_referrer_plan.deposit_commission_rate;

      -- CRITICAL FIX: Only check if deposit_commission_rate > 0
      -- DO NOT check referral_eligible for deposit commissions
      -- This allows free plans to give and receive deposit commissions
      IF v_referrer_plan.deposit_commission_rate > 0 THEN
        -- Calculate commission based on REFERRER's plan rate
        v_commission_amount := p_amount * v_referrer_plan.deposit_commission_rate;
        
        RAISE NOTICE '[DIAG-5] Commission eligible. Amount: % (rate: %)', 
          v_commission_amount, v_referrer_plan.deposit_commission_rate;

        -- Create audit log entry BEFORE processing
        INSERT INTO commission_audit_log (
          commission_type,
          referrer_id,
          referred_id,
          deposit_transaction_id,
          commission_amount,
          status,
          error_details
        ) VALUES (
          'deposit',
          v_referrer_id,
          p_user_id,
          v_transaction_id,
          v_commission_amount,
          'processing',
          jsonb_build_object(
            'referrer_plan', v_referrer_plan.plan_name,
            'deposit_commission_rate', v_referrer_plan.deposit_commission_rate,
            'deposit_amount', p_amount
          )
        )
        RETURNING id INTO v_audit_log_id;

        RAISE NOTICE '[DIAG-6] Audit log created. ID: %', v_audit_log_id;

        BEGIN
          -- Credit referrer's earnings wallet
          UPDATE profiles
          SET 
            earnings_wallet_balance = earnings_wallet_balance + v_commission_amount,
            total_earned = total_earned + v_commission_amount,
            last_activity = NOW()
          WHERE id = v_referrer_id;

          IF NOT FOUND THEN
            RAISE EXCEPTION 'Referrer not found during commission credit: %', v_referrer_id;
          END IF;

          RAISE NOTICE '[DIAG-7] Referrer earnings wallet credited with: %', v_commission_amount;

          -- Create commission transaction for referrer
          INSERT INTO transactions (
            user_id,
            type,
            amount,
            wallet_type,
            status,
            payment_gateway,
            metadata
          ) VALUES (
            v_referrer_id,
            'referral_commission',
            v_commission_amount,
            'earnings',
            'completed',
            'internal',
            jsonb_build_object(
              'commission_type', 'deposit',
              'referred_user_id', p_user_id,
              'deposit_transaction_id', v_transaction_id,
              'deposit_amount', p_amount,
              'commission_rate', v_referrer_plan.deposit_commission_rate
            )
          )
          RETURNING id INTO v_commission_transaction_id;

          RAISE NOTICE '[DIAG-8] Commission transaction created. ID: %', v_commission_transaction_id;

          -- Create referral earnings record
          INSERT INTO referral_earnings (
            referrer_id,
            referred_user_id,
            earning_type,
            base_amount,
            commission_rate,
            commission_amount,
            metadata
          ) VALUES (
            v_referrer_id,
            p_user_id,
            'deposit',
            p_amount,
            v_referrer_plan.deposit_commission_rate,
            v_commission_amount,
            jsonb_build_object(
              'transaction_id', v_commission_transaction_id,
              'deposit_transaction_id', v_transaction_id
            )
          )
          RETURNING id INTO v_referral_earning_id;

          RAISE NOTICE '[DIAG-9] Referral earnings record created. ID: %', v_referral_earning_id;

          -- Update audit log to success
          UPDATE commission_audit_log
          SET 
            status = 'success',
            error_details = jsonb_build_object(
              'commission_transaction_id', v_commission_transaction_id,
              'referral_earning_id', v_referral_earning_id,
              'completed_at', NOW()
            )
          WHERE id = v_audit_log_id;

          RAISE NOTICE '[DIAG-10] Audit log updated to success';

        EXCEPTION WHEN OTHERS THEN
          -- Update audit log with error
          UPDATE commission_audit_log
          SET 
            status = 'failed',
            error_details = jsonb_build_object(
              'error_message', SQLERRM,
              'error_state', SQLSTATE,
              'failed_at', NOW()
            )
          WHERE id = v_audit_log_id;

          RAISE NOTICE '[DIAG-ERROR] Commission processing failed: %', SQLERRM;
          -- Don't fail the entire deposit, just log the commission error
        END;
      ELSE
        RAISE NOTICE '[DIAG-11] Referrer not eligible: deposit_commission_rate is 0';
      END IF;
    ELSE
      RAISE NOTICE '[DIAG-12] Referrer plan not found or inactive';
    END IF;
  ELSE
    RAISE NOTICE '[DIAG-13] No active referral relationship found';
  END IF;

  -- Return success response
  v_result := jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'new_balance', v_new_balance,
    'commission_processed', v_commission_amount IS NOT NULL,
    'commission_amount', COALESCE(v_commission_amount, 0)
  );

  RAISE NOTICE '[DIAG-FINAL] Deposit completed successfully: %', v_result;

  RETURN v_result;
END;
$$;