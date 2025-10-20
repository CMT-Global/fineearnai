-- Fix: Allow pending transactions by validating balances only when status = 'completed'
-- This addresses CPAY deposit failures caused by the BEFORE trigger rejecting
-- insertion of 'pending' deposit transactions with unchanged balances.

CREATE OR REPLACE FUNCTION public.validate_transaction_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_balance NUMERIC(10, 2);
BEGIN
  -- Only enforce balance validations for completed transactions
  -- Pending and other non-completed statuses act as placeholders and should not
  -- be blocked by balance checks.
  IF NEW.status IS DISTINCT FROM 'completed' THEN
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

  -- Validate new_balance matches expected balance after applying the transaction
  IF NEW.type IN ('deposit', 'task_earning', 'referral_commission', 'adjustment') THEN
    IF NEW.amount > 0 AND NEW.new_balance != current_balance + NEW.amount THEN
      RAISE EXCEPTION 'Transaction balance mismatch';
    END IF;
  ELSIF NEW.type IN ('withdrawal', 'plan_upgrade', 'transfer') THEN
    IF NEW.amount > 0 AND NEW.new_balance != current_balance - NEW.amount THEN
      RAISE EXCEPTION 'Transaction balance mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;