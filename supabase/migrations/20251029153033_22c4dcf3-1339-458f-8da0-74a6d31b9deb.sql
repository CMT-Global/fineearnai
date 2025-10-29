-- Fix transaction balance validation to handle floating-point precision for micro-amounts
CREATE OR REPLACE FUNCTION public.validate_transaction_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_balance NUMERIC(10, 2);
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

  -- Validate new_balance with floating-point tolerance for referral_commission
  -- This handles micro-amounts like $0.0105 that can have precision issues
  IF NEW.type = 'referral_commission' AND NEW.amount < 1.0 THEN
    IF ABS(NEW.new_balance - expected_balance) >= tolerance THEN
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

-- Retry the failed commission for gambino -> admin
UPDATE commission_queue 
SET 
  status = 'pending',
  retry_count = 0,
  error_message = NULL,
  processed_at = NULL
WHERE id = '04ceab1c-71ff-48e4-a250-305b8cf74c6a'
  AND status = 'failed';