-- Create referral_earnings table to track commission history
CREATE TABLE public.referral_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  earning_type TEXT NOT NULL CHECK (earning_type IN ('task_commission', 'deposit_commission')),
  base_amount NUMERIC(10, 2) NOT NULL,
  commission_amount NUMERIC(10, 2) NOT NULL,
  commission_rate NUMERIC(5, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for referral_earnings
CREATE POLICY "Users can view their own referral earnings"
  ON public.referral_earnings FOR SELECT
  USING (auth.uid() = referrer_id);

CREATE POLICY "Admins can view all referral earnings"
  ON public.referral_earnings FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage referral earnings"
  ON public.referral_earnings FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX idx_referral_earnings_referrer ON public.referral_earnings(referrer_id);
CREATE INDEX idx_referral_earnings_referred_user ON public.referral_earnings(referred_user_id);
CREATE INDEX idx_referral_earnings_created_at ON public.referral_earnings(created_at DESC);

-- Function to get referral statistics
CREATE OR REPLACE FUNCTION public.get_referral_stats(user_uuid UUID)
RETURNS TABLE (
  total_referrals BIGINT,
  active_referrals BIGINT,
  total_earnings NUMERIC,
  task_commission_earnings NUMERIC,
  deposit_commission_earnings NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COUNT(DISTINCT p.id) as total_referrals,
    COUNT(DISTINCT CASE WHEN p.tasks_completed_today > 0 THEN p.id END) as active_referrals,
    COALESCE(SUM(re.commission_amount), 0) as total_earnings,
    COALESCE(SUM(CASE WHEN re.earning_type = 'task_commission' THEN re.commission_amount ELSE 0 END), 0) as task_commission_earnings,
    COALESCE(SUM(CASE WHEN re.earning_type = 'deposit_commission' THEN re.commission_amount ELSE 0 END), 0) as deposit_commission_earnings
  FROM public.profiles p
  LEFT JOIN public.referral_earnings re ON re.referrer_id = user_uuid
  WHERE p.referred_by = user_uuid;
$$;

-- Update the complete-task edge function trigger to also pay referrer commission
-- This will be handled in the edge function code