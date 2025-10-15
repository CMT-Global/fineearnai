
-- =============================================
-- Phase 2: Database Foundation & Performance Optimization
-- =============================================

-- =============================================
-- 2.1 CREATE MISSING CORE TABLES
-- =============================================

-- Create referrals table for tracking individual referral relationships
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code_used TEXT NOT NULL,
  total_commission_earned NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  last_commission_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(referrer_id, referred_id)
);

-- Create referral_program_config table for global referral settings
CREATE TABLE IF NOT EXISTS public.referral_program_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_deposit_commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0000 CHECK (personal_deposit_commission_rate >= 0 AND personal_deposit_commission_rate <= 1),
  business_task_commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0000 CHECK (business_task_commission_rate >= 0 AND business_task_commission_rate <= 1),
  business_deposit_commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0000 CHECK (business_deposit_commission_rate >= 0 AND business_deposit_commission_rate <= 1),
  personal_referrals_enabled BOOLEAN NOT NULL DEFAULT true,
  business_referrals_enabled BOOLEAN NOT NULL DEFAULT true,
  signup_bonus_enabled BOOLEAN NOT NULL DEFAULT false,
  signup_bonus_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default referral program config
INSERT INTO public.referral_program_config (id) 
VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- Create group_account_config table
CREATE TABLE IF NOT EXISTS public.group_account_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_earning_rate_for_sub_accounts NUMERIC(5,4) NOT NULL DEFAULT 0.7000 CHECK (default_earning_rate_for_sub_accounts >= 0 AND default_earning_rate_for_sub_accounts <= 1),
  default_commission_rate_to_master NUMERIC(5,4) NOT NULL DEFAULT 0.3000 CHECK (default_commission_rate_to_master >= 0 AND default_commission_rate_to_master <= 1),
  enable_master_account_top_up BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default group account config
INSERT INTO public.group_account_config (id)
VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- Create user_activity_log table
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- 2.2 ENHANCE EXISTING TABLES
-- =============================================

-- Add missing columns to profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS current_plan_start_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS total_earned NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP WITH TIME ZONE;

-- Add missing columns to membership_plans table
ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS billing_period_unit TEXT NOT NULL DEFAULT 'month' CHECK (billing_period_unit IN ('day', 'month', 'year')),
  ADD COLUMN IF NOT EXISTS billing_period_value INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS free_plan_expiry_days INTEGER,
  ADD COLUMN IF NOT EXISTS free_unlock_withdrawal_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS free_unlock_withdrawal_days INTEGER,
  ADD COLUMN IF NOT EXISTS sub_account_earning_commission_rate NUMERIC(5,4) DEFAULT 0.0000 CHECK (sub_account_earning_commission_rate >= 0 AND sub_account_earning_commission_rate <= 1),
  ADD COLUMN IF NOT EXISTS max_group_members INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority_support BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_categories BOOLEAN NOT NULL DEFAULT false;

-- =============================================
-- 2.3 PERFORMANCE INDEXES & CONSTRAINTS
-- =============================================

-- Profiles performance indexes
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by) WHERE referred_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_membership_plan ON public.profiles(membership_plan);
CREATE INDEX IF NOT EXISTS idx_profiles_plan_expires_at ON public.profiles(plan_expires_at) WHERE plan_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_auto_renew ON public.profiles(auto_renew) WHERE auto_renew = true;

-- Referrals performance indexes
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_created ON public.referrals(referrer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_created ON public.referrals(referred_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_code_used ON public.referrals(referral_code_used);

-- Transactions performance indexes (composite for filtering)
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON public.transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type_status ON public.transactions(type, status);

-- Referral earnings performance indexes (composite)
CREATE INDEX IF NOT EXISTS idx_referral_earnings_referrer_created ON public.referral_earnings(referrer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_earnings_referred_created ON public.referral_earnings(referred_user_id, created_at DESC);

-- User activity log performance indexes
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_created ON public.user_activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_activity_type ON public.user_activity_log(activity_type);

-- =============================================
-- 2.4 ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on new tables
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_program_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_account_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

-- Referrals policies
CREATE POLICY "Users can view their own referrals as referrer"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id);

CREATE POLICY "Users can view their own referrals as referred"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referred_id);

CREATE POLICY "Admins can manage all referrals"
  ON public.referrals FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Referral program config policies
CREATE POLICY "Anyone can view referral program config"
  ON public.referral_program_config FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage referral program config"
  ON public.referral_program_config FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Group account config policies
CREATE POLICY "Anyone can view group account config"
  ON public.group_account_config FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage group account config"
  ON public.group_account_config FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- User activity log policies
CREATE POLICY "Users can view their own activity log"
  ON public.user_activity_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity logs"
  ON public.user_activity_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert activity logs"
  ON public.user_activity_log FOR INSERT
  WITH CHECK (true);

-- =============================================
-- 2.5 DATABASE FUNCTIONS
-- =============================================

-- Function to calculate prorated cost for plan upgrades
CREATE OR REPLACE FUNCTION public.calculate_proration(
  p_current_plan_price NUMERIC,
  p_current_plan_start_date TIMESTAMP WITH TIME ZONE,
  p_current_plan_billing_days INTEGER,
  p_new_plan_price NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days_in_period INTEGER;
  v_days_used INTEGER;
  v_days_remaining INTEGER;
  v_daily_rate NUMERIC;
  v_credit NUMERIC;
  v_new_cost NUMERIC;
  v_savings NUMERIC;
BEGIN
  -- Calculate days in current billing period
  v_days_in_period := p_current_plan_billing_days;
  
  -- Calculate days used since plan started
  v_days_used := EXTRACT(DAY FROM (now() - p_current_plan_start_date));
  
  -- Calculate days remaining (cannot be negative)
  v_days_remaining := GREATEST(0, v_days_in_period - v_days_used);
  
  -- Calculate daily rate of current plan
  v_daily_rate := p_current_plan_price / NULLIF(v_days_in_period, 0);
  
  -- Calculate credit for unused days
  v_credit := v_daily_rate * v_days_remaining;
  
  -- Calculate new cost after applying credit
  v_new_cost := GREATEST(0, p_new_plan_price - v_credit);
  
  -- Calculate total savings
  v_savings := v_credit;
  
  RETURN jsonb_build_object(
    'days_remaining', v_days_remaining,
    'daily_rate', v_daily_rate,
    'credit', v_credit,
    'original_price', p_new_plan_price,
    'new_cost', v_new_cost,
    'savings', v_savings
  );
END;
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger for referral_program_config updated_at
DROP TRIGGER IF EXISTS update_referral_program_config_updated_at ON public.referral_program_config;
CREATE TRIGGER update_referral_program_config_updated_at
  BEFORE UPDATE ON public.referral_program_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for group_account_config updated_at
DROP TRIGGER IF EXISTS update_group_account_config_updated_at ON public.group_account_config;
CREATE TRIGGER update_group_account_config_updated_at
  BEFORE UPDATE ON public.group_account_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
