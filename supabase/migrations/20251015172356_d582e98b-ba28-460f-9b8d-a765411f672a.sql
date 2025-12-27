-- Phase 1: Asynchronous Commission Processing Infrastructure

-- Create commission queue table (idempotent)
CREATE TABLE IF NOT EXISTS public.commission_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('task', 'deposit', 'upgrade')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  commission_rate NUMERIC(5,4) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 1),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Create indexes for performance (idempotent)
CREATE INDEX IF NOT EXISTS idx_commission_queue_status_created ON public.commission_queue(status, created_at) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_commission_queue_referrer ON public.commission_queue(referrer_id);
CREATE INDEX IF NOT EXISTS idx_commission_queue_referred_user ON public.commission_queue(referred_user_id);

-- Enable RLS (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'commission_queue' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.commission_queue ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- RLS Policies (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'commission_queue' 
    AND policyname = 'Admins can view all commission queue'
  ) THEN
    CREATE POLICY "Admins can view all commission queue" 
    ON public.commission_queue 
    FOR SELECT 
    USING (has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'commission_queue' 
    AND policyname = 'Service role can manage commission queue'
  ) THEN
    CREATE POLICY "Service role can manage commission queue" 
    ON public.commission_queue 
    FOR ALL 
    USING (true);
  END IF;
END $$;

-- Create atomic commission processing function
-- Using DO block to ensure proper parsing
DO $$
BEGIN
  EXECUTE '
CREATE OR REPLACE FUNCTION public.process_commission_atomic(
  p_referrer_id UUID,
  p_commission_amount NUMERIC,
  p_referred_user_id UUID,
  p_event_type TEXT,
  p_base_amount NUMERIC,
  p_commission_rate NUMERIC,
  p_metadata JSONB
) RETURNS JSONB AS $func$
DECLARE
  v_new_balance NUMERIC;
  v_result JSONB;
BEGIN
  UPDATE public.profiles 
  SET 
    earnings_wallet_balance = earnings_wallet_balance + p_commission_amount,
    total_earned = total_earned + p_commission_amount
  WHERE id = p_referrer_id
  RETURNING earnings_wallet_balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION ''Referrer profile not found: %'', p_referrer_id;
  END IF;

  INSERT INTO public.referral_earnings (
    referrer_id, 
    referred_user_id, 
    earning_type,
    base_amount, 
    commission_amount, 
    commission_rate, 
    metadata
  ) VALUES (
    p_referrer_id, 
    p_referred_user_id, 
    p_event_type || ''_commission'',
    p_base_amount, 
    p_commission_amount,
    p_commission_rate, 
    p_metadata
  );

  INSERT INTO public.transactions (
    user_id, 
    type, 
    amount, 
    wallet_type, 
    status, 
    new_balance, 
    metadata,
    description
  ) VALUES (
    p_referrer_id, 
    ''referral_commission'', 
    p_commission_amount,
    ''earnings'', 
    ''completed'', 
    v_new_balance, 
    p_metadata,
    ''Commission from '' || p_event_type || '' by referral''
  );

  UPDATE public.referrals
  SET 
    total_commission_earned = total_commission_earned + p_commission_amount,
    last_commission_date = now()
  WHERE referrer_id = p_referrer_id AND referred_id = p_referred_user_id;

  v_result := jsonb_build_object(
    ''success'', true,
    ''new_balance'', v_new_balance,
    ''commission_amount'', p_commission_amount
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  v_result := jsonb_build_object(
    ''success'', false,
    ''error'', SQLERRM
  );
  RETURN v_result;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
';
END $$;

-- Create monitoring view (idempotent)
-- Note: Split into separate statement to avoid parsing issues
DROP VIEW IF EXISTS public.commission_queue_health;

CREATE VIEW public.commission_queue_health AS
SELECT 
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest_job,
  MAX(created_at) as newest_job,
  EXTRACT(EPOCH FROM (now() - MIN(created_at))) as oldest_job_age_seconds,
  AVG(retry_count) as avg_retry_count
FROM public.commission_queue
GROUP BY status;