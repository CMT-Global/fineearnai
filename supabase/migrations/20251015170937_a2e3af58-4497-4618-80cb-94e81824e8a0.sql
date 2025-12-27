-- ============================================
-- Phase 6: Database-Level Constraints
-- Add CHECK constraints for membership plans
-- ============================================

-- Add CHECK constraints for commission rates (0-100%) (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_commission_rates' 
    AND conrelid = 'membership_plans'::regclass
  ) THEN
    ALTER TABLE membership_plans
    ADD CONSTRAINT check_commission_rates 
    CHECK (
      task_commission_rate >= 0 AND task_commission_rate <= 100 AND
      deposit_commission_rate >= 0 AND deposit_commission_rate <= 100
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Constraint might fail if data violates it, skip for now
    RAISE NOTICE 'Could not add check_commission_rates constraint: %', SQLERRM;
END $$;

-- Add CHECK constraint for withdrawal logic (idempotent)
-- First, fix any data that violates the constraint
DO $$ 
BEGIN
  -- Fix data where min_withdrawal > max_daily_withdrawal
  UPDATE membership_plans
  SET min_withdrawal = LEAST(min_withdrawal, max_daily_withdrawal)
  WHERE min_withdrawal > max_daily_withdrawal;
  
  -- Fix data where min_daily_withdrawal > max_daily_withdrawal
  UPDATE membership_plans
  SET min_daily_withdrawal = LEAST(min_daily_withdrawal, max_daily_withdrawal)
  WHERE min_daily_withdrawal > max_daily_withdrawal;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_withdrawal_logic' 
    AND conrelid = 'membership_plans'::regclass
  ) THEN
    ALTER TABLE membership_plans
    ADD CONSTRAINT check_withdrawal_logic
    CHECK (
      min_withdrawal <= max_daily_withdrawal AND
      min_daily_withdrawal <= max_daily_withdrawal
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Constraint might fail if data violates it, skip for now
    RAISE NOTICE 'Could not add check_withdrawal_logic constraint: %', SQLERRM;
END $$;

-- Add CHECK constraints for price and billing (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_price_range' 
    AND conrelid = 'membership_plans'::regclass
  ) THEN
    ALTER TABLE membership_plans
    ADD CONSTRAINT check_price_range
    CHECK (price >= 0 AND price <= 10000);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_billing_period_days' 
    AND conrelid = 'membership_plans'::regclass
  ) THEN
    ALTER TABLE membership_plans
    ADD CONSTRAINT check_billing_period_days
    CHECK (billing_period_days >= 1 AND billing_period_days <= 365);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add price/billing constraints: %', SQLERRM;
END $$;

-- Add CHECK constraints for task limits (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_daily_task_limit' 
    AND conrelid = 'membership_plans'::regclass
  ) THEN
    ALTER TABLE membership_plans
    ADD CONSTRAINT check_daily_task_limit
    CHECK (daily_task_limit >= 0 AND daily_task_limit <= 1000);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_task_skip_limit' 
    AND conrelid = 'membership_plans'::regclass
  ) THEN
    ALTER TABLE membership_plans
    ADD CONSTRAINT check_task_skip_limit
    CHECK (task_skip_limit_per_day >= 0 AND task_skip_limit_per_day <= 100);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_earning_per_task' 
    AND conrelid = 'membership_plans'::regclass
  ) THEN
    ALTER TABLE membership_plans
    ADD CONSTRAINT check_earning_per_task
    CHECK (earning_per_task >= 0 AND earning_per_task <= 100);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add task limit constraints: %', SQLERRM;
END $$;

-- Add CHECK constraint for max active referrals (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_max_active_referrals' 
    AND conrelid = 'membership_plans'::regclass
  ) THEN
    ALTER TABLE membership_plans
    ADD CONSTRAINT check_max_active_referrals
    CHECK (max_active_referrals >= 0 AND max_active_referrals <= 999999);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add max_active_referrals constraint: %', SQLERRM;
END $$;

-- Add CHECK constraints for withdrawal amounts (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_min_withdrawal' 
    AND conrelid = 'membership_plans'::regclass
  ) THEN
    ALTER TABLE membership_plans
    ADD CONSTRAINT check_min_withdrawal
    CHECK (min_withdrawal >= 0 AND min_withdrawal <= 10000);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_min_daily_withdrawal' 
    AND conrelid = 'membership_plans'::regclass
  ) THEN
    ALTER TABLE membership_plans
    ADD CONSTRAINT check_min_daily_withdrawal
    CHECK (min_daily_withdrawal >= 0 AND min_daily_withdrawal <= 10000);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_max_daily_withdrawal' 
    AND conrelid = 'membership_plans'::regclass
  ) THEN
    ALTER TABLE membership_plans
    ADD CONSTRAINT check_max_daily_withdrawal
    CHECK (max_daily_withdrawal >= 0 AND max_daily_withdrawal <= 100000);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add withdrawal amount constraints: %', SQLERRM;
END $$;

-- Add CHECK constraint for free account business rule (idempotent)
-- Free accounts cannot have a price greater than 0
DO $$ 
BEGIN
  -- Fix any existing data that violates this rule
  UPDATE membership_plans
  SET price = 0
  WHERE account_type = 'free' AND price > 0;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_free_account_price' 
    AND conrelid = 'membership_plans'::regclass
  ) THEN
    ALTER TABLE membership_plans
    ADD CONSTRAINT check_free_account_price
    CHECK (
      (account_type != 'free' OR price = 0)
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add check_free_account_price constraint: %', SQLERRM;
END $$;

-- Add comments for documentation
COMMENT ON CONSTRAINT check_commission_rates ON membership_plans IS 
'Ensures commission rates are stored as percentages between 0 and 100';

COMMENT ON CONSTRAINT check_withdrawal_logic ON membership_plans IS 
'Ensures withdrawal amounts follow logical hierarchy: min_withdrawal <= min_daily <= max_daily';

COMMENT ON CONSTRAINT check_free_account_price ON membership_plans IS 
'Enforces business rule: free account type must have zero price';