-- Fix: Add 'deposit' to atomic transaction skip list in validate_transaction_balance trigger
-- 
-- PROBLEM: Deposits were failing with "Transaction balance mismatch" errors
-- ROOT CAUSE: credit_deposit_atomic_v2 updates profile balance BEFORE inserting transaction
--             Trigger validates balance using current (already updated) balance, causing mismatch
-- SOLUTION: Skip validation for atomic deposit transactions (same as plan_upgrade, task_earning, referral_commission)
--
-- IMPACT: Enables automatic commission processing for deposits
-- RISK: Minimal - follows existing pattern for other atomic transactions

CREATE OR REPLACE FUNCTION public.validate_transaction_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_balance NUMERIC(10, 4);
  expected_balance NUMERIC(10, 4);
  tolerance NUMERIC := 0.0001;
BEGIN
  -- Only enforce balance validations for completed transactions
  IF NEW.status IS DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;

  -- CRITICAL FIX: Skip validation for transactions processed atomically
  -- These transactions are created AFTER profile balance is already updated
  -- Validating would cause false mismatches
  -- ADDED: 'deposit' to skip list (processed by credit_deposit_atomic_v2)
  IF NEW.type IN ('plan_upgrade', 'task_earning', 'referral_commission', 'deposit') THEN
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

  -- Calculate expected balance with 4 decimal precision
  IF NEW.type IN ('deposit', 'adjustment') THEN
    expected_balance := current_balance + NEW.amount;
  ELSIF NEW.type IN ('withdrawal', 'transfer') THEN
    expected_balance := current_balance - NEW.amount;
  ELSE
    -- For unknown types, skip validation
    RETURN NEW;
  END IF;

  -- Validate new_balance (only for non-atomic transactions)
  IF ROUND(NEW.new_balance, 2) != ROUND(expected_balance, 2) THEN
    RAISE EXCEPTION 'Transaction balance mismatch: expected %, got %', 
      ROUND(expected_balance, 2), ROUND(NEW.new_balance, 2);
  END IF;

  RETURN NEW;
END;
$function$;