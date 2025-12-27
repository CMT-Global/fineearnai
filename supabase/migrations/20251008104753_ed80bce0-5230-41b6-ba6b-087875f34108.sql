-- Create withdrawal_requests table (idempotent)
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  net_amount NUMERIC(10, 2) NOT NULL,
  fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  payout_address TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processing', 'completed', 'failed')),
  payment_processor_id TEXT,
  rejection_reason TEXT,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add payeer_payout_addresses to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS payeer_payout_addresses JSONB DEFAULT '[]'::jsonb;

-- Create platform_config table
CREATE TABLE IF NOT EXISTS public.platform_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default payout schedule (Monday, Wednesday, Friday)
INSERT INTO public.platform_config (key, value, description)
VALUES 
  ('payout_days', '["1", "3", "5"]'::jsonb, 'Days of the week for payouts (0=Sunday, 6=Saturday)'),
  ('withdrawal_fee_percentage', '2'::jsonb, 'Withdrawal fee percentage')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'withdrawal_requests' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'platform_config' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- RLS Policies for withdrawal_requests (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'withdrawal_requests' 
    AND policyname = 'Users can view their own withdrawal requests'
  ) THEN
    CREATE POLICY "Users can view their own withdrawal requests"
      ON public.withdrawal_requests FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'withdrawal_requests' 
    AND policyname = 'Users can create their own withdrawal requests'
  ) THEN
    CREATE POLICY "Users can create their own withdrawal requests"
      ON public.withdrawal_requests FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'withdrawal_requests' 
    AND policyname = 'Admins can view all withdrawal requests'
  ) THEN
    CREATE POLICY "Admins can view all withdrawal requests"
      ON public.withdrawal_requests FOR SELECT
      USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'withdrawal_requests' 
    AND policyname = 'Admins can update withdrawal requests'
  ) THEN
    CREATE POLICY "Admins can update withdrawal requests"
      ON public.withdrawal_requests FOR UPDATE
      USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- RLS Policies for platform_config (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'platform_config' 
    AND policyname = 'Anyone can view platform config'
  ) THEN
    CREATE POLICY "Anyone can view platform config"
      ON public.platform_config FOR SELECT
      USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'platform_config' 
    AND policyname = 'Admins can manage platform config'
  ) THEN
    CREATE POLICY "Admins can manage platform config"
      ON public.platform_config FOR ALL
      USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Add indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON public.withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON public.withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created_at ON public.withdrawal_requests(created_at DESC);

-- Trigger for updated_at (idempotent)
DROP TRIGGER IF EXISTS update_withdrawal_requests_updated_at ON public.withdrawal_requests;
CREATE TRIGGER update_withdrawal_requests_updated_at
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tasks_updated_at();

DROP TRIGGER IF EXISTS update_platform_config_updated_at ON public.platform_config;
CREATE TRIGGER update_platform_config_updated_at
  BEFORE UPDATE ON public.platform_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tasks_updated_at();