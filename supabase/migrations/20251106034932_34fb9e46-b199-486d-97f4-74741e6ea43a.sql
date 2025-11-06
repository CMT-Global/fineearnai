-- ============================================================================
-- PHASE 1: DATABASE FOUNDATION FOR TOP-UP VOUCHER SYSTEM
-- ============================================================================

-- 1. EXTEND app_role ENUM TO INCLUDE 'partner'
-- ============================================================================
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'partner';

-- 2. CREATE partner_applications TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.partner_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Contact Information
  preferred_contact_method TEXT NOT NULL CHECK (preferred_contact_method IN ('whatsapp', 'telegram', 'both')),
  whatsapp_number TEXT,
  telegram_username TEXT,
  whatsapp_group_link TEXT,
  telegram_group_link TEXT,
  
  -- Additional Details
  application_notes TEXT,
  rejection_reason TEXT,
  
  -- Admin Actions
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id)
);

-- Create indexes for partner_applications
CREATE INDEX idx_partner_applications_user_id ON public.partner_applications(user_id);
CREATE INDEX idx_partner_applications_status ON public.partner_applications(status);
CREATE INDEX idx_partner_applications_created_at ON public.partner_applications(created_at DESC);

-- Enable RLS
ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for partner_applications
CREATE POLICY "Users can view their own applications"
  ON public.partner_applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own applications"
  ON public.partner_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all applications"
  ON public.partner_applications FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update applications"
  ON public.partner_applications FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. CREATE partner_config TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.partner_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  
  -- Commission Settings
  commission_rate NUMERIC NOT NULL DEFAULT 0.10 CHECK (commission_rate >= 0 AND commission_rate <= 1),
  use_global_commission BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Payment Methods (stored as JSONB for flexibility)
  payment_methods JSONB NOT NULL DEFAULT '[]'::JSONB,
  
  -- Sales Tracking
  total_vouchers_sold INTEGER NOT NULL DEFAULT 0,
  total_commission_earned NUMERIC NOT NULL DEFAULT 0.00,
  daily_sales NUMERIC NOT NULL DEFAULT 0.00,
  weekly_sales NUMERIC NOT NULL DEFAULT 0.00,
  
  -- Rank Information
  current_rank TEXT NOT NULL DEFAULT 'bronze',
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_sale_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for partner_config
CREATE INDEX idx_partner_config_user_id ON public.partner_config(user_id);
CREATE INDEX idx_partner_config_current_rank ON public.partner_config(current_rank);
CREATE INDEX idx_partner_config_daily_sales ON public.partner_config(daily_sales DESC);

-- Enable RLS
ALTER TABLE public.partner_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for partner_config
CREATE POLICY "Partners can view their own config"
  ON public.partner_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Partners can update their own payment methods"
  ON public.partner_config FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all partner configs"
  ON public.partner_config FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all partner configs"
  ON public.partner_config FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert partner configs"
  ON public.partner_config FOR INSERT
  WITH CHECK (true);

-- 4. CREATE partner_ranks TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.partner_ranks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rank_name TEXT NOT NULL UNIQUE,
  daily_sales_target NUMERIC NOT NULL,
  commission_rate NUMERIC NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 1),
  rank_order INTEGER NOT NULL UNIQUE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for partner_ranks
CREATE INDEX idx_partner_ranks_order ON public.partner_ranks(rank_order ASC);

-- Enable RLS
ALTER TABLE public.partner_ranks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for partner_ranks
CREATE POLICY "Anyone can view partner ranks"
  ON public.partner_ranks FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage partner ranks"
  ON public.partner_ranks FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default partner ranks
INSERT INTO public.partner_ranks (rank_name, daily_sales_target, commission_rate, rank_order)
VALUES
  ('bronze', 250, 0.10, 1),
  ('silver', 500, 0.15, 2),
  ('gold', 1000, 0.175, 3),
  ('platinum', 2000, 0.20, 4)
ON CONFLICT (rank_name) DO NOTHING;

-- 5. CREATE vouchers TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_code TEXT NOT NULL UNIQUE,
  
  -- Partner & User Information
  partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Financial Details
  voucher_amount NUMERIC NOT NULL CHECK (voucher_amount > 0),
  partner_paid_amount NUMERIC NOT NULL CHECK (partner_paid_amount >= 0),
  commission_amount NUMERIC NOT NULL CHECK (commission_amount >= 0),
  commission_rate NUMERIC NOT NULL,
  
  -- Status & Lifecycle
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'expired', 'cancelled')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  redeemed_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  purchase_transaction_id UUID REFERENCES public.transactions(id),
  redemption_transaction_id UUID REFERENCES public.transactions(id),
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for vouchers
CREATE INDEX idx_vouchers_voucher_code ON public.vouchers(voucher_code);
CREATE INDEX idx_vouchers_partner_id ON public.vouchers(partner_id);
CREATE INDEX idx_vouchers_status ON public.vouchers(status);
CREATE INDEX idx_vouchers_expires_at ON public.vouchers(expires_at);
CREATE INDEX idx_vouchers_redeemed_by ON public.vouchers(redeemed_by_user_id);

-- Enable RLS
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vouchers
CREATE POLICY "Partners can view their own vouchers"
  ON public.vouchers FOR SELECT
  USING (auth.uid() = partner_id);

CREATE POLICY "Users can view vouchers they redeemed"
  ON public.vouchers FOR SELECT
  USING (auth.uid() = redeemed_by_user_id);

CREATE POLICY "Admins can view all vouchers"
  ON public.vouchers FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert vouchers"
  ON public.vouchers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update vouchers"
  ON public.vouchers FOR UPDATE
  USING (true);

-- 6. CREATE partner_activity_log TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.partner_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('application_submitted', 'application_approved', 'application_rejected', 'voucher_purchased', 'voucher_redeemed', 'rank_updated', 'commission_earned', 'payment_method_updated')),
  
  -- Activity Details
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  
  -- Related Records
  voucher_id UUID REFERENCES public.vouchers(id),
  transaction_id UUID REFERENCES public.transactions(id),
  
  -- IP Tracking
  ip_address TEXT,
  
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for partner_activity_log
CREATE INDEX idx_partner_activity_log_partner_id ON public.partner_activity_log(partner_id);
CREATE INDEX idx_partner_activity_log_activity_type ON public.partner_activity_log(activity_type);
CREATE INDEX idx_partner_activity_log_created_at ON public.partner_activity_log(created_at DESC);
CREATE INDEX idx_partner_activity_log_voucher_id ON public.partner_activity_log(voucher_id);

-- Enable RLS
ALTER TABLE public.partner_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for partner_activity_log
CREATE POLICY "Partners can view their own activity"
  ON public.partner_activity_log FOR SELECT
  USING (auth.uid() = partner_id);

CREATE POLICY "Admins can view all activity"
  ON public.partner_activity_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert activity logs"
  ON public.partner_activity_log FOR INSERT
  WITH CHECK (true);

-- 7. CREATE DATABASE FUNCTIONS
-- ============================================================================

-- Function: Generate unique voucher code
CREATE OR REPLACE FUNCTION public.generate_voucher_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 12-character alphanumeric code (FE-XXXX-XXXX-XXXX)
    v_code := 'FE-' || 
              UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 4)) || '-' ||
              UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 4)) || '-' ||
              UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 4));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.vouchers WHERE voucher_code = v_code) INTO v_exists;
    
    -- Exit loop if unique code generated
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_code;
END;
$$;

-- Function: Get partner commission rate (custom or rank-based)
CREATE OR REPLACE FUNCTION public.get_partner_commission_rate(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_config RECORD;
  v_rank_commission NUMERIC;
BEGIN
  -- Get partner config
  SELECT * INTO v_partner_config
  FROM public.partner_config
  WHERE user_id = p_user_id
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN 0.10; -- Default 10% if no config found
  END IF;
  
  -- If using global commission, get from rank
  IF v_partner_config.use_global_commission THEN
    SELECT commission_rate INTO v_rank_commission
    FROM public.partner_ranks
    WHERE rank_name = v_partner_config.current_rank
    LIMIT 1;
    
    RETURN COALESCE(v_rank_commission, 0.10);
  ELSE
    -- Use custom commission rate
    RETURN v_partner_config.commission_rate;
  END IF;
END;
$$;

-- Function: Update partner rank based on sales
CREATE OR REPLACE FUNCTION public.update_partner_rank(p_partner_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_daily_sales NUMERIC;
  v_new_rank TEXT;
  v_old_rank TEXT;
BEGIN
  -- Get current daily sales and old rank
  SELECT daily_sales, current_rank INTO v_daily_sales, v_old_rank
  FROM public.partner_config
  WHERE user_id = p_partner_id
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Partner config not found for user %', p_partner_id;
    RETURN NULL;
  END IF;
  
  -- Determine new rank based on daily sales (descending order)
  SELECT rank_name INTO v_new_rank
  FROM public.partner_ranks
  WHERE daily_sales_target <= v_daily_sales
  ORDER BY rank_order DESC
  LIMIT 1;
  
  -- Default to bronze if no rank matches
  v_new_rank := COALESCE(v_new_rank, 'bronze');
  
  -- Update rank if changed
  IF v_new_rank != v_old_rank THEN
    UPDATE public.partner_config
    SET current_rank = v_new_rank, updated_at = NOW()
    WHERE user_id = p_partner_id;
    
    -- Log rank update activity
    INSERT INTO public.partner_activity_log (partner_id, activity_type, details)
    VALUES (
      p_partner_id,
      'rank_updated',
      jsonb_build_object(
        'old_rank', v_old_rank,
        'new_rank', v_new_rank,
        'daily_sales', v_daily_sales
      )
    );
    
    RAISE NOTICE 'Partner % rank updated: % -> %', p_partner_id, v_old_rank, v_new_rank;
  END IF;
  
  RETURN v_new_rank;
END;
$$;

-- Function: Reset daily/weekly sales counters (called by cron)
CREATE OR REPLACE FUNCTION public.reset_partner_sales_counters()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_day INTEGER;
BEGIN
  -- Get current day of week (0 = Sunday, 1 = Monday, etc.)
  v_current_day := EXTRACT(DOW FROM NOW());
  
  -- Reset daily sales for all partners
  UPDATE public.partner_config
  SET daily_sales = 0, updated_at = NOW();
  
  RAISE NOTICE 'Reset daily sales for all partners';
  
  -- Reset weekly sales on Monday (day 1)
  IF v_current_day = 1 THEN
    UPDATE public.partner_config
    SET weekly_sales = 0, updated_at = NOW();
    
    RAISE NOTICE 'Reset weekly sales for all partners (Monday reset)';
  END IF;
END;
$$;

-- 8. CREATE TRIGGER FOR UPDATED_AT TIMESTAMPS
-- ============================================================================
CREATE TRIGGER update_partner_applications_updated_at
  BEFORE UPDATE ON public.partner_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partner_config_updated_at
  BEFORE UPDATE ON public.partner_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partner_ranks_updated_at
  BEFORE UPDATE ON public.partner_ranks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- PHASE 1 COMPLETE: Database foundation ready for voucher system
-- ============================================================================