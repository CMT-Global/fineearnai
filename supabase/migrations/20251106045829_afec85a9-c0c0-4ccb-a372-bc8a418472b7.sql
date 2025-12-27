-- ============================================================================
-- PHASE 1: Partner Weekly Bonus System - Database Schema
-- ============================================================================

-- 1. Create partner_bonus_tiers table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.partner_bonus_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name TEXT NOT NULL UNIQUE,
  min_weekly_sales NUMERIC NOT NULL CHECK (min_weekly_sales >= 0),
  max_weekly_sales NUMERIC NOT NULL CHECK (max_weekly_sales > min_weekly_sales),
  bonus_percentage NUMERIC NOT NULL CHECK (bonus_percentage >= 0 AND bonus_percentage <= 1),
  tier_order INTEGER NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create partner_weekly_bonuses table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.partner_weekly_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  total_weekly_sales NUMERIC NOT NULL DEFAULT 0 CHECK (total_weekly_sales >= 0),
  qualified_tier_id UUID REFERENCES public.partner_bonus_tiers(id) ON DELETE SET NULL,
  bonus_percentage NUMERIC DEFAULT 0 CHECK (bonus_percentage >= 0 AND bonus_percentage <= 1),
  bonus_amount NUMERIC DEFAULT 0 CHECK (bonus_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'calculated', 'paid', 'failed')),
  paid_at TIMESTAMPTZ,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(partner_id, week_start_date),
  CHECK (week_end_date > week_start_date)
);

-- 3. Add platform config entries for bonus system
-- ============================================================================
INSERT INTO public.platform_config (key, value, description)
VALUES 
  ('partner_bonus_system_enabled', 'false'::jsonb, 'Enable/disable weekly partner bonus system'),
  ('partner_bonus_payout_day', '0'::jsonb, 'Day of week for payouts (0=Sunday, 1=Monday, etc.)'),
  ('partner_bonus_payout_time', '"00:00"'::jsonb, 'UTC time for bonus payouts (HH:MM format)')
ON CONFLICT (key) DO NOTHING;

-- 4. Create indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_weekly_bonuses_partner_week 
  ON public.partner_weekly_bonuses(partner_id, week_start_date DESC);

CREATE INDEX IF NOT EXISTS idx_weekly_bonuses_status 
  ON public.partner_weekly_bonuses(status) 
  WHERE status IN ('pending', 'calculated');

CREATE INDEX IF NOT EXISTS idx_weekly_bonuses_week_dates 
  ON public.partner_weekly_bonuses(week_start_date, week_end_date);

CREATE INDEX IF NOT EXISTS idx_bonus_tiers_sales_range 
  ON public.partner_bonus_tiers(min_weekly_sales, max_weekly_sales) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_bonus_tiers_order 
  ON public.partner_bonus_tiers(tier_order) 
  WHERE is_active = true;

-- 5. Add updated_at triggers
-- ============================================================================
DROP TRIGGER IF EXISTS update_partner_bonus_tiers_updated_at ON public.partner_bonus_tiers;
CREATE TRIGGER update_partner_bonus_tiers_updated_at
  BEFORE UPDATE ON public.partner_bonus_tiers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_partner_weekly_bonuses_updated_at ON public.partner_weekly_bonuses;
CREATE TRIGGER update_partner_weekly_bonuses_updated_at
  BEFORE UPDATE ON public.partner_weekly_bonuses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Enable Row Level Security
-- ============================================================================
ALTER TABLE public.partner_bonus_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_weekly_bonuses ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for partner_bonus_tiers
-- ============================================================================

-- Admins can manage all bonus tiers
DROP POLICY IF EXISTS "Admins can manage bonus tiers" ON public.partner_bonus_tiers;
CREATE POLICY "Admins can manage bonus tiers"
  ON public.partner_bonus_tiers
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view active bonus tiers
DROP POLICY IF EXISTS "Anyone can view active bonus tiers" ON public.partner_bonus_tiers;
CREATE POLICY "Anyone can view active bonus tiers"
  ON public.partner_bonus_tiers
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 8. RLS Policies for partner_weekly_bonuses
-- ============================================================================

-- Admins can view all weekly bonuses
DROP POLICY IF EXISTS "Admins can view all weekly bonuses" ON public.partner_weekly_bonuses;
CREATE POLICY "Admins can view all weekly bonuses"
  ON public.partner_weekly_bonuses
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update weekly bonuses
DROP POLICY IF EXISTS "Admins can update weekly bonuses" ON public.partner_weekly_bonuses;
CREATE POLICY "Admins can update weekly bonuses"
  ON public.partner_weekly_bonuses
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Partners can view their own weekly bonuses
DROP POLICY IF EXISTS "Partners can view their own weekly bonuses" ON public.partner_weekly_bonuses;
CREATE POLICY "Partners can view their own weekly bonuses"
  ON public.partner_weekly_bonuses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = partner_id);

-- System can insert weekly bonus records
DROP POLICY IF EXISTS "System can insert weekly bonuses" ON public.partner_weekly_bonuses;
CREATE POLICY "System can insert weekly bonuses"
  ON public.partner_weekly_bonuses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 9. Insert default bonus tiers (seed data)
-- ============================================================================
INSERT INTO public.partner_bonus_tiers (tier_name, min_weekly_sales, max_weekly_sales, bonus_percentage, tier_order, is_active)
SELECT * FROM (VALUES 
  ('Starter', 0, 500, 0.01, 1, true),
  ('Bronze', 501, 1000, 0.015, 2, true),
  ('Silver', 1001, 2500, 0.02, 3, true),
  ('Gold', 2501, 999999999, 0.03, 4, true)
) AS v(tier_name, min_weekly_sales, max_weekly_sales, bonus_percentage, tier_order, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.partner_bonus_tiers WHERE tier_name = v.tier_name
);

-- 10. Add comments for documentation
-- ============================================================================
COMMENT ON TABLE public.partner_bonus_tiers IS 'Configuration table for partner weekly bonus tier thresholds and percentages';
COMMENT ON TABLE public.partner_weekly_bonuses IS 'Tracks weekly bonus calculations and payments for partners';
COMMENT ON COLUMN public.partner_weekly_bonuses.week_start_date IS 'Sunday of the bonus week';
COMMENT ON COLUMN public.partner_weekly_bonuses.week_end_date IS 'Saturday of the bonus week';
COMMENT ON COLUMN public.partner_weekly_bonuses.status IS 'pending: awaiting calculation, calculated: ready for payout, paid: credited to wallet, failed: error occurred';
COMMENT ON COLUMN public.partner_bonus_tiers.bonus_percentage IS 'Stored as decimal (0.01 = 1%, 0.03 = 3%)';
