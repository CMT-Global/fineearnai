-- Create transaction type enum (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
    CREATE TYPE public.transaction_type AS ENUM (
      'deposit',
      'withdrawal',
      'task_earning',
      'referral_commission',
      'plan_upgrade',
      'transfer',
      'adjustment'
    );
  END IF;
END $$;

-- Create wallet type enum (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wallet_type') THEN
    CREATE TYPE public.wallet_type AS ENUM ('deposit', 'earnings');
  END IF;
END $$;

-- Create transaction status enum (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_status') THEN
    CREATE TYPE public.transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
  END IF;
END $$;

-- Create transactions table (idempotent)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  wallet_type wallet_type NOT NULL,
  status transaction_status NOT NULL DEFAULT 'completed',
  payment_gateway TEXT,
  gateway_transaction_id TEXT,
  new_balance NUMERIC(10, 2) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'transactions' 
    AND policyname = 'Users can view their own transactions'
  ) THEN
    CREATE POLICY "Users can view their own transactions"
    ON public.transactions
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Admins can view all transactions (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'transactions' 
    AND policyname = 'Admins can view all transactions'
  ) THEN
    CREATE POLICY "Admins can view all transactions"
    ON public.transactions
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Admins can insert transactions (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'transactions' 
    AND policyname = 'Admins can insert transactions'
  ) THEN
    CREATE POLICY "Admins can insert transactions"
    ON public.transactions
    FOR INSERT
    WITH CHECK (has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Admins can update transactions (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'transactions' 
    AND policyname = 'Admins can update transactions'
  ) THEN
    CREATE POLICY "Admins can update transactions"
    ON public.transactions
    FOR UPDATE
    USING (has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Create indexes for performance (idempotent)
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_type ON public.transactions(wallet_type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);

-- Create function to validate transaction balance
CREATE OR REPLACE FUNCTION public.validate_transaction_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance NUMERIC(10, 2);
BEGIN
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

  -- Validate new_balance matches actual balance after transaction
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
$$;

-- Create trigger for balance validation (idempotent)
DROP TRIGGER IF EXISTS validate_transaction_balance_trigger ON public.transactions;
CREATE TRIGGER validate_transaction_balance_trigger
BEFORE INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.validate_transaction_balance();