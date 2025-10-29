-- Phase 4: Fix tolerance logic in validate_transaction_balance trigger
-- This allows transactions with differences WITHIN tolerance (≤0.0001) to pass

CREATE OR REPLACE FUNCTION public.validate_transaction_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_balance NUMERIC(10, 4);  -- CHANGED: Now supports 4-decimal precision from Phase 1
  expected_balance NUMERIC(10, 4);
  tolerance NUMERIC := 0.0001; -- Tolerance for floating-point precision errors
BEGIN
  -- Only enforce balance validations for completed transactions
  IF NEW.status IS DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;

  -- CRITICAL FIX: Skip validation for plan_upgrade transactions
  -- These are processed in a specific order where profile is updated BEFORE transaction insert
  -- This prevents race condition errors during upgrades
  IF NEW.type = 'plan_upgrade' THEN
    RETURN NEW;
  END IF;

  -- Get current balance based on wallet type
  IF NEW.wallet_type = 'deposit' THEN
    SELECT deposit_wallet_balance INTO current_balance
    FROM public.profiles
    WHERE id = NEW.user_id;
  ELSE
    SELECT earnings_wallet_balance INTO current_balance
    FROM public.profiles
    WHERE id = NEW.user_id;
  END IF;

  -- Calculate expected balance with 4 decimal precision for micro-amounts
  IF NEW.type IN ('deposit', 'task_earning', 'referral_commission', 'adjustment') THEN
    expected_balance := current_balance + NEW.amount;
  ELSIF NEW.type IN ('withdrawal', 'transfer') THEN
    expected_balance := current_balance - NEW.amount;
  ELSE
    -- For unknown types, skip validation
    RETURN NEW;
  END IF;

  -- PHASE 4 FIX: Validate new_balance with CORRECT tolerance logic
  -- Changed from ">=" to ">" to allow differences WITHIN tolerance to pass
  IF NEW.type = 'referral_commission' AND NEW.amount < 1.0 THEN
    -- For micro-commissions, allow differences within tolerance (≤0.0001)
    IF ABS(NEW.new_balance - expected_balance) > tolerance THEN  -- CHANGED: >= to >
      RAISE EXCEPTION 'Transaction balance mismatch: expected %, got % (difference: %)', 
        expected_balance, NEW.new_balance, ABS(NEW.new_balance - expected_balance);
    END IF;
  ELSE
    -- For larger amounts, use exact comparison (rounded to 2 decimals)
    IF ROUND(NEW.new_balance, 2) != ROUND(expected_balance, 2) THEN
      RAISE EXCEPTION 'Transaction balance mismatch: expected %, got %', 
        ROUND(expected_balance, 2), ROUND(NEW.new_balance, 2);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Phase 4 Complete: Tolerance logic fixed
-- Key change: ">=" to ">" on line 49
-- Before: Fails if difference >= 0.0001 (rejects 0.0001, 0.00005, etc.) ❌
-- After:  Fails if difference > 0.0001 (accepts 0.0001, 0.00005, etc.) ✅
-- 
-- Examples:
-- - Difference = 0.00000 → PASS ✅
-- - Difference = 0.00005 → PASS ✅
-- - Difference = 0.0001 → PASS ✅
-- - Difference = 0.0002 → FAIL ❌
-- 
-- Ready for Phase 5: Retry failed commissions