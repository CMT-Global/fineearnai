-- Create membership_plans table (idempotent)
CREATE TABLE IF NOT EXISTS public.membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('free', 'personal', 'business', 'group')),
  price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  billing_period_days INTEGER NOT NULL DEFAULT 30,
  daily_task_limit INTEGER NOT NULL DEFAULT 10,
  earning_per_task NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  task_skip_limit_per_day INTEGER NOT NULL DEFAULT 0,
  min_withdrawal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  min_daily_withdrawal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  max_daily_withdrawal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  max_active_referrals INTEGER NOT NULL DEFAULT 0,
  task_commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  deposit_commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  features JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'membership_plans' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create policies - everyone can view active plans (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'membership_plans' 
    AND policyname = 'Anyone can view active membership plans'
  ) THEN
    CREATE POLICY "Anyone can view active membership plans"
    ON public.membership_plans
    FOR SELECT
    USING (is_active = true);
  END IF;
END $$;

-- Admins can manage all plans (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'membership_plans' 
    AND policyname = 'Admins can manage membership plans'
  ) THEN
    CREATE POLICY "Admins can manage membership plans"
    ON public.membership_plans
    FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Create index for faster lookups (idempotent)
CREATE INDEX IF NOT EXISTS idx_membership_plans_name ON public.membership_plans(name);
CREATE INDEX IF NOT EXISTS idx_membership_plans_active ON public.membership_plans(is_active);

-- Insert default membership plans (idempotent - only insert if they don't exist)
INSERT INTO public.membership_plans (name, display_name, account_type, price, billing_period_days, daily_task_limit, earning_per_task, task_skip_limit_per_day, min_withdrawal, min_daily_withdrawal, max_daily_withdrawal, max_active_referrals, task_commission_rate, deposit_commission_rate, features) VALUES
('free', 'Free Plan', 'free', 0.00, 365, 10, 0.05, 0, 50.00, 0.00, 0.00, 0, 0.00, 0.00, '["Basic task access", "10 tasks per day", "No referral commissions", "Withdrawal after 60 days"]'::jsonb),
('personal', 'Personal Plan', 'personal', 25.00, 30, 50, 0.12, 3, 10.00, 5.00, 100.00, 50, 10.00, 5.00, '["50 tasks per day", "Higher earnings per task", "3 skips per day", "10% task commission", "5% deposit commission", "Instant withdrawals"]'::jsonb),
('business', 'Business Plan', 'business', 75.00, 30, 150, 0.15, 5, 5.00, 5.00, 500.00, 200, 15.00, 10.00, '["150 tasks per day", "Premium earnings", "5 skips per day", "15% task commission", "10% deposit commission", "Priority withdrawals", "200 active referrals"]'::jsonb),
('group', 'Group Plan', 'group', 200.00, 30, 500, 0.20, 10, 5.00, 10.00, 2000.00, 999999, 20.00, 15.00, '["500 tasks per day", "Maximum earnings", "10 skips per day", "20% task commission", "15% deposit commission", "Unlimited referrals", "VIP support"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_membership_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic timestamp updates (idempotent)
DROP TRIGGER IF EXISTS update_membership_plans_updated_at ON public.membership_plans;
CREATE TRIGGER update_membership_plans_updated_at
BEFORE UPDATE ON public.membership_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_membership_plans_updated_at();