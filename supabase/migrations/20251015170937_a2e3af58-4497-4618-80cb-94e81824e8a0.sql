-- ============================================
-- Phase 6: Database-Level Constraints
-- Add CHECK constraints for membership plans
-- ============================================

-- Add CHECK constraints for commission rates (0-100%)
ALTER TABLE membership_plans
ADD CONSTRAINT check_commission_rates 
CHECK (
  task_commission_rate >= 0 AND task_commission_rate <= 100 AND
  deposit_commission_rate >= 0 AND deposit_commission_rate <= 100
);

-- Add CHECK constraint for withdrawal logic
ALTER TABLE membership_plans
ADD CONSTRAINT check_withdrawal_logic
CHECK (
  min_withdrawal <= max_daily_withdrawal AND
  min_daily_withdrawal <= max_daily_withdrawal
);

-- Add CHECK constraints for price and billing
ALTER TABLE membership_plans
ADD CONSTRAINT check_price_range
CHECK (price >= 0 AND price <= 10000);

ALTER TABLE membership_plans
ADD CONSTRAINT check_billing_period_days
CHECK (billing_period_days >= 1 AND billing_period_days <= 365);

-- Add CHECK constraints for task limits
ALTER TABLE membership_plans
ADD CONSTRAINT check_daily_task_limit
CHECK (daily_task_limit >= 0 AND daily_task_limit <= 1000);

ALTER TABLE membership_plans
ADD CONSTRAINT check_task_skip_limit
CHECK (task_skip_limit_per_day >= 0 AND task_skip_limit_per_day <= 100);

-- Add CHECK constraint for earning per task
ALTER TABLE membership_plans
ADD CONSTRAINT check_earning_per_task
CHECK (earning_per_task >= 0 AND earning_per_task <= 100);

-- Add CHECK constraint for max active referrals
ALTER TABLE membership_plans
ADD CONSTRAINT check_max_active_referrals
CHECK (max_active_referrals >= 0 AND max_active_referrals <= 999999);

-- Add CHECK constraints for withdrawal amounts
ALTER TABLE membership_plans
ADD CONSTRAINT check_min_withdrawal
CHECK (min_withdrawal >= 0 AND min_withdrawal <= 10000);

ALTER TABLE membership_plans
ADD CONSTRAINT check_min_daily_withdrawal
CHECK (min_daily_withdrawal >= 0 AND min_daily_withdrawal <= 10000);

ALTER TABLE membership_plans
ADD CONSTRAINT check_max_daily_withdrawal
CHECK (max_daily_withdrawal >= 0 AND max_daily_withdrawal <= 100000);

-- Add CHECK constraint for free account business rule
-- Free accounts cannot have a price greater than 0
ALTER TABLE membership_plans
ADD CONSTRAINT check_free_account_price
CHECK (
  (account_type != 'free' OR price = 0)
);

-- Add comments for documentation
COMMENT ON CONSTRAINT check_commission_rates ON membership_plans IS 
'Ensures commission rates are stored as percentages between 0 and 100';

COMMENT ON CONSTRAINT check_withdrawal_logic ON membership_plans IS 
'Ensures withdrawal amounts follow logical hierarchy: min_withdrawal <= min_daily <= max_daily';

COMMENT ON CONSTRAINT check_free_account_price ON membership_plans IS 
'Enforces business rule: free account type must have zero price';