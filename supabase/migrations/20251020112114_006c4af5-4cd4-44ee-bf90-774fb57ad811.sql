-- Insert CPAY payment processor configurations
-- Only insert if they don't already exist

-- CPAY Deposit Processor
INSERT INTO public.payment_processors (
  name,
  processor_type,
  is_active,
  fee_percentage,
  fee_fixed,
  min_amount,
  max_amount,
  config
)
SELECT 
  'cpay_deposit',
  'deposit',
  false, -- Set to inactive by default, admin can activate
  0.00,
  0.00,
  10.00,
  10000.00,
  jsonb_build_object(
    'display_name', 'CPAY (USDT)',
    'supported_currencies', jsonb_build_array('USDT'),
    'processor', 'cpay',
    'description', 'Deposit via CPAY payment gateway (USDT)'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_processors 
  WHERE name = 'cpay_deposit'
);

-- CPAY Withdrawal Processor
INSERT INTO public.payment_processors (
  name,
  processor_type,
  is_active,
  fee_percentage,
  fee_fixed,
  min_amount,
  max_amount,
  config
)
SELECT
  'cpay_withdrawal_usdt_trc20',
  'withdrawal',
  false, -- Set to inactive by default, admin can activate
  0.00,
  1.00, -- $1 flat fee for withdrawals
  10.00,
  10000.00,
  jsonb_build_object(
    'display_name', 'CPAY USDT (TRC20)',
    'network', 'TRC20',
    'currency', 'USDT',
    'processor', 'cpay',
    'description', 'Withdraw USDT via CPAY to TRC20 address',
    'address_label', 'USDT TRC20 Address',
    'address_placeholder', 'Enter your USDT TRC20 wallet address'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_processors 
  WHERE name = 'cpay_withdrawal_usdt_trc20'
);