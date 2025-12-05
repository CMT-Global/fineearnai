-- ============================================================================
-- FineEarn Platform - Complete Database Schema for Self-Hosted Migration
-- Generated: 2024-12-05
-- ============================================================================

-- ============================================================================
-- SECTION 1: EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SECTION 2: CUSTOM TYPES / ENUMS
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE account_status AS ENUM ('active', 'suspended', 'banned');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE task_difficulty AS ENUM ('easy', 'medium', 'hard');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('assigned', 'in_progress', 'completed', 'skipped', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM (
    'deposit', 'withdrawal', 'task_earning', 'referral_commission', 
    'plan_upgrade', 'transfer', 'bonus', 'voucher_purchase', 
    'voucher_redemption', 'partner_commission', 'weekly_bonus'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE wallet_type AS ENUM ('deposit', 'earnings');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- SECTION 3: CORE TABLES
-- ============================================================================

-- User Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  country TEXT,
  referral_code TEXT NOT NULL UNIQUE,
  membership_plan TEXT NOT NULL DEFAULT 'free',
  plan_expires_at TIMESTAMPTZ,
  current_plan_start_date TIMESTAMPTZ,
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  account_status account_status NOT NULL DEFAULT 'active',
  deposit_wallet_balance NUMERIC NOT NULL DEFAULT 0.00,
  earnings_wallet_balance NUMERIC NOT NULL DEFAULT 0.00,
  total_earned NUMERIC NOT NULL DEFAULT 0.00,
  tasks_completed_today INTEGER NOT NULL DEFAULT 0,
  skips_today INTEGER NOT NULL DEFAULT 0,
  last_task_date DATE,
  last_login TIMESTAMPTZ,
  last_activity TIMESTAMPTZ,
  payeer_payout_addresses JSONB DEFAULT '[]'::jsonb,
  usdt_bep20_address TEXT,
  usdc_solana_address TEXT,
  preferred_currency TEXT NOT NULL DEFAULT 'USD',
  email_verified BOOLEAN DEFAULT false,
  email_verified_at TIMESTAMPTZ,
  allow_daily_withdrawals BOOLEAN NOT NULL DEFAULT false,
  withdrawal_addresses_updated_at TIMESTAMPTZ,
  registration_ip TEXT,
  registration_country TEXT,
  registration_country_name TEXT,
  last_login_ip TEXT,
  last_login_country TEXT,
  last_login_country_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Membership Plans
CREATE TABLE IF NOT EXISTS public.membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0.00,
  billing_period_days INTEGER NOT NULL DEFAULT 30,
  billing_period_value INTEGER NOT NULL DEFAULT 1,
  billing_period_unit TEXT NOT NULL DEFAULT 'month',
  daily_task_limit INTEGER NOT NULL DEFAULT 10,
  earning_per_task NUMERIC NOT NULL DEFAULT 0.00,
  task_skip_limit_per_day INTEGER NOT NULL DEFAULT 0,
  min_withdrawal NUMERIC NOT NULL DEFAULT 0.00,
  min_daily_withdrawal NUMERIC NOT NULL DEFAULT 0.00,
  max_daily_withdrawal NUMERIC NOT NULL DEFAULT 0.00,
  max_active_referrals INTEGER NOT NULL DEFAULT 0,
  task_commission_rate NUMERIC NOT NULL DEFAULT 0.00,
  deposit_commission_rate NUMERIC NOT NULL DEFAULT 0.00,
  referral_eligible BOOLEAN NOT NULL DEFAULT true,
  priority_support BOOLEAN NOT NULL DEFAULT false,
  custom_categories BOOLEAN NOT NULL DEFAULT false,
  max_group_members INTEGER NOT NULL DEFAULT 0,
  sub_account_earning_commission_rate NUMERIC DEFAULT 0.0000,
  free_plan_expiry_days INTEGER,
  free_unlock_withdrawal_enabled BOOLEAN NOT NULL DEFAULT false,
  free_unlock_withdrawal_days INTEGER,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI Tasks
CREATE TABLE IF NOT EXISTS public.ai_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt TEXT NOT NULL,
  prompt_hash TEXT,
  response_a TEXT NOT NULL,
  response_b TEXT NOT NULL,
  correct_response TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty task_difficulty NOT NULL DEFAULT 'medium',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Task Completions
CREATE TABLE IF NOT EXISTS public.task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.ai_tasks(id) ON DELETE CASCADE,
  selected_response TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  earnings_amount NUMERIC NOT NULL DEFAULT 0,
  time_taken_seconds INTEGER NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, task_id)
);

-- Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  amount NUMERIC NOT NULL,
  wallet_type wallet_type NOT NULL,
  status transaction_status NOT NULL DEFAULT 'pending',
  new_balance NUMERIC NOT NULL,
  description TEXT,
  payment_gateway TEXT,
  gateway_transaction_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Referrals
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code_used TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  total_commission_earned NUMERIC NOT NULL DEFAULT 0,
  last_commission_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(referred_id)
);

-- Referral Earnings
CREATE TABLE IF NOT EXISTS public.referral_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referred_user_id UUID NOT NULL,
  earning_type TEXT NOT NULL,
  base_amount NUMERIC NOT NULL,
  commission_rate NUMERIC NOT NULL,
  commission_amount NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Referral Program Config
CREATE TABLE IF NOT EXISTS public.referral_program_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signup_bonus_enabled BOOLEAN NOT NULL DEFAULT false,
  signup_bonus_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Withdrawal Requests
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  fee NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL,
  payout_address TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  payment_processor_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  processed_by UUID,
  rejection_reason TEXT,
  gateway_transaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payment Processors
CREATE TABLE IF NOT EXISTS public.payment_processors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  processor_type TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  fee_fixed NUMERIC NOT NULL DEFAULT 0.00,
  fee_percentage NUMERIC NOT NULL DEFAULT 0.00,
  min_amount NUMERIC NOT NULL DEFAULT 0.00,
  max_amount NUMERIC NOT NULL DEFAULT 10000.00,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Platform Config
CREATE TABLE IF NOT EXISTS public.platform_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  target_user_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email Templates
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  template_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  use_wrapper_in_editor BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email Logs
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  recipient_user_id UUID,
  template_id UUID REFERENCES public.email_templates(id),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  sent_by UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bulk Email Jobs
CREATE TABLE IF NOT EXISTS public.bulk_email_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued',
  total_recipients INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  successful_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  cancel_requested BOOLEAN DEFAULT false,
  duplicate_check_hash TEXT,
  processing_worker_id TEXT,
  last_heartbeat TIMESTAMPTZ,
  processing_metadata JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  estimated_completion_at TIMESTAMPTZ,
  last_processed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scheduled Emails
CREATE TABLE IF NOT EXISTS public.scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.email_templates(id),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email Verification OTPs
CREATE TABLE IF NOT EXISTS public.email_verification_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Email Verification Reminders
CREATE TABLE IF NOT EXISTS public.email_verification_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  reminder_count INTEGER NOT NULL DEFAULT 0,
  last_reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Password Reset Tokens
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Account Deletion OTPs
CREATE TABLE IF NOT EXISTS public.account_deletion_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Master Login Sessions
CREATE TABLE IF NOT EXISTS public.master_login_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  one_time_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Daily Reset Logs
CREATE TABLE IF NOT EXISTS public.daily_reset_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reset_date DATE NOT NULL,
  users_reset INTEGER NOT NULL,
  triggered_by TEXT NOT NULL DEFAULT 'cron',
  execution_time_ms INTEGER,
  details JSONB DEFAULT '{}'::jsonb,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Edge Function Metrics
CREATE TABLE IF NOT EXISTS public.edge_function_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  execution_time_ms INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  user_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Task Pool Metrics
CREATE TABLE IF NOT EXISTS public.task_pool_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_task_count INTEGER NOT NULL,
  active_task_count INTEGER NOT NULL,
  tasks_completed_last_24h INTEGER NOT NULL,
  average_completion_rate NUMERIC,
  alert_triggered BOOLEAN DEFAULT false,
  alert_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Commission Audit Log
CREATE TABLE IF NOT EXISTS public.commission_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_type TEXT NOT NULL,
  referrer_id UUID,
  referred_id UUID,
  deposit_transaction_id UUID,
  commission_amount NUMERIC DEFAULT 0,
  status TEXT NOT NULL,
  error_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CPAY Checkouts
CREATE TABLE IF NOT EXISTS public.cpay_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_id TEXT NOT NULL,
  checkout_url TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USDT',
  min_amount NUMERIC NOT NULL DEFAULT 0.00,
  max_amount NUMERIC NOT NULL DEFAULT 10000.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Group Account Config
CREATE TABLE IF NOT EXISTS public.group_account_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enable_master_account_top_up BOOLEAN NOT NULL DEFAULT true,
  default_commission_rate_to_master NUMERIC NOT NULL DEFAULT 0.3000,
  default_earning_rate_for_sub_accounts NUMERIC NOT NULL DEFAULT 0.7000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- How It Works Steps
CREATE TABLE IF NOT EXISTS public.how_it_works_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_name TEXT NOT NULL DEFAULT 'HelpCircle',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- How It Works PDF Documents
CREATE TABLE IF NOT EXISTS public.how_it_works_pdf_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  file_url TEXT,
  file_size_bytes BIGINT,
  content_snapshot JSONB,
  ai_prompt_used TEXT,
  generation_error TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  generated_by UUID,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  rejected_reason TEXT,
  download_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- SECTION 4: PARTNER SYSTEM TABLES
-- ============================================================================

-- Partner Config
CREATE TABLE IF NOT EXISTS public.partner_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  commission_rate NUMERIC NOT NULL DEFAULT 0.10,
  use_global_commission BOOLEAN NOT NULL DEFAULT true,
  current_rank TEXT NOT NULL DEFAULT 'bronze',
  daily_sales NUMERIC NOT NULL DEFAULT 0.00,
  weekly_sales NUMERIC NOT NULL DEFAULT 0.00,
  total_vouchers_sold INTEGER NOT NULL DEFAULT 0,
  total_commission_earned NUMERIC NOT NULL DEFAULT 0.00,
  last_sale_at TIMESTAMPTZ,
  payment_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partner Ranks
CREATE TABLE IF NOT EXISTS public.partner_ranks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rank_name TEXT NOT NULL UNIQUE,
  rank_order INTEGER NOT NULL,
  daily_sales_target NUMERIC NOT NULL,
  commission_rate NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partner Applications
CREATE TABLE IF NOT EXISTS public.partner_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  preferred_contact_method TEXT NOT NULL,
  telegram_username TEXT,
  whatsapp_number TEXT,
  telegram_group_link TEXT,
  whatsapp_group_link TEXT,
  community_group_links TEXT,
  local_payment_methods TEXT,
  manages_community BOOLEAN,
  promoted_platforms BOOLEAN,
  can_provide_local_support BOOLEAN,
  organize_training_sessions BOOLEAN,
  agrees_to_guidelines BOOLEAN,
  applicant_country TEXT,
  current_membership_plan TEXT,
  motivation_text TEXT,
  network_description TEXT,
  platform_promotion_details TEXT,
  support_preference TEXT,
  community_member_count TEXT,
  daily_time_commitment TEXT,
  weekly_time_commitment TEXT,
  expected_monthly_onboarding TEXT,
  is_currently_employed BOOLEAN,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  upgraded_referrals INTEGER NOT NULL DEFAULT 0,
  application_notes TEXT,
  rejection_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partner Onboarding
CREATE TABLE IF NOT EXISTS public.partner_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL UNIQUE,
  setup_completed BOOLEAN NOT NULL DEFAULT false,
  steps_completed JSONB NOT NULL DEFAULT '{"guidelines_read": false, "community_joined": false, "profile_completed": false, "payment_methods_set": false, "first_voucher_created": false}'::jsonb,
  completed_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partner Activity Log
CREATE TABLE IF NOT EXISTS public.partner_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL,
  activity_type TEXT NOT NULL,
  transaction_id UUID,
  voucher_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partner Debug Logs
CREATE TABLE IF NOT EXISTS public.partner_debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  correlation_id TEXT NOT NULL,
  event TEXT NOT NULL,
  level TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partner Bonus Tiers
CREATE TABLE IF NOT EXISTS public.partner_bonus_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name TEXT NOT NULL,
  tier_order INTEGER NOT NULL,
  min_weekly_sales NUMERIC NOT NULL,
  max_weekly_sales NUMERIC NOT NULL,
  bonus_percentage NUMERIC NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partner Weekly Bonuses
CREATE TABLE IF NOT EXISTS public.partner_weekly_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  total_weekly_sales NUMERIC NOT NULL DEFAULT 0,
  qualified_tier_id UUID REFERENCES public.partner_bonus_tiers(id),
  bonus_percentage NUMERIC DEFAULT 0,
  bonus_amount NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  transaction_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vouchers
CREATE TABLE IF NOT EXISTS public.vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_code TEXT NOT NULL UNIQUE,
  partner_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  recipient_user_id UUID,
  recipient_username TEXT,
  redeemed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  purchase_transaction_id UUID,
  redemption_transaction_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Activity Log
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks (legacy)
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  difficulty task_difficulty NOT NULL DEFAULT 'medium',
  base_reward NUMERIC NOT NULL DEFAULT 0.00,
  time_estimate_minutes INTEGER NOT NULL DEFAULT 5,
  instructions JSONB,
  validation_criteria JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Tasks (legacy)
CREATE TABLE IF NOT EXISTS public.user_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  status task_status NOT NULL DEFAULT 'assigned',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  skipped_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  earned_amount NUMERIC,
  submission_data JSONB
);

-- ============================================================================
-- SECTION 5: INDEXES
-- ============================================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_membership_plan ON public.profiles(membership_plan);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_country ON public.profiles(country);

-- Transactions indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON public.transactions(user_id, type);

-- Task completions indexes
CREATE INDEX IF NOT EXISTS idx_task_completions_user_id ON public.task_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_task_id ON public.task_completions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_completed_at ON public.task_completions(completed_at);

-- Referrals indexes
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON public.referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

-- AI Tasks indexes
CREATE INDEX IF NOT EXISTS idx_ai_tasks_is_active ON public.ai_tasks(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_category ON public.ai_tasks(category);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_created_at ON public.ai_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_prompt_hash ON public.ai_tasks(prompt_hash);

-- Partner indexes
CREATE INDEX IF NOT EXISTS idx_partner_config_user_id ON public.partner_config(user_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_partner_id ON public.vouchers(partner_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_voucher_code ON public.vouchers(voucher_code);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON public.vouchers(status);

-- Withdrawal requests indexes
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON public.withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON public.withdrawal_requests(status);

-- ============================================================================
-- SECTION 6: HELPER FUNCTION - has_role
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_role(user_id UUID, check_role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = $1
    AND user_roles.role = $2
  );
END;
$$;

-- ============================================================================
-- SECTION 7: DATABASE FUNCTIONS
-- ============================================================================

-- Get username by referral code
CREATE OR REPLACE FUNCTION public.get_username_by_referral_code(p_referral_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
BEGIN
  SELECT username INTO v_username
  FROM public.profiles
  WHERE referral_code = UPPER(TRIM(p_referral_code))
  LIMIT 1;
  
  RETURN v_username;
END;
$$;

-- Update updated_at column trigger function
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

-- Validate profile update trigger function
CREATE OR REPLACE FUNCTION public.validate_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  SELECT has_role(auth.uid(), 'admin'::app_role) INTO is_admin;
  
  IF is_admin THEN
    RETURN NEW;
  END IF;
  
  IF (OLD.tasks_completed_today IS DISTINCT FROM NEW.tasks_completed_today AND OLD.tasks_completed_today IS NOT NULL) OR
     (OLD.skips_today IS DISTINCT FROM NEW.skips_today AND OLD.skips_today IS NOT NULL) OR
     (OLD.earnings_wallet_balance IS DISTINCT FROM NEW.earnings_wallet_balance AND OLD.earnings_wallet_balance IS NOT NULL) OR
     (OLD.deposit_wallet_balance IS DISTINCT FROM NEW.deposit_wallet_balance AND OLD.deposit_wallet_balance IS NOT NULL) OR
     (OLD.total_earned IS DISTINCT FROM NEW.total_earned AND OLD.total_earned IS NOT NULL) OR
     (OLD.membership_plan IS DISTINCT FROM NEW.membership_plan AND OLD.membership_plan IS NOT NULL) OR
     (OLD.plan_expires_at IS DISTINCT FROM NEW.plan_expires_at AND OLD.plan_expires_at IS NOT NULL) OR
     (OLD.account_status IS DISTINCT FROM NEW.account_status AND OLD.account_status IS NOT NULL) OR
     (OLD.referral_code IS DISTINCT FROM NEW.referral_code AND OLD.referral_code IS NOT NULL) THEN
    RAISE EXCEPTION 'Cannot update sensitive profile fields from client';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Get current UTC day
CREATE OR REPLACE FUNCTION public.get_current_utc_day()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXTRACT(DOW FROM (NOW() AT TIME ZONE 'UTC'))::INTEGER;
END;
$$;

-- Get current UTC time
CREATE OR REPLACE FUNCTION public.get_current_utc_time()
RETURNS TEXT
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN TO_CHAR((NOW() AT TIME ZONE 'UTC'), 'HH24:MI');
END;
$$;

-- Check if withdrawal is allowed
CREATE OR REPLACE FUNCTION public.is_withdrawal_allowed()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  schedule JSONB;
  current_day INTEGER;
  utc_time TEXT;
  day_schedule JSONB;
BEGIN
  current_day := EXTRACT(DOW FROM (NOW() AT TIME ZONE 'UTC'))::INTEGER;
  utc_time := TO_CHAR((NOW() AT TIME ZONE 'UTC'), 'HH24:MI');
  
  SELECT value INTO schedule
  FROM public.platform_config
  WHERE key = 'payout_schedule';
  
  IF schedule IS NULL THEN
    SELECT value INTO schedule
    FROM public.platform_config
    WHERE key = 'payout_days';
    
    IF schedule IS NOT NULL AND jsonb_typeof(schedule) = 'array' THEN
      IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(schedule) elem 
        WHERE elem::text::integer = current_day
      ) THEN
        RETURN TRUE;
      ELSE
        RETURN FALSE;
      END IF;
    ELSE
      RETURN FALSE;
    END IF;
  END IF;
  
  SELECT elem INTO day_schedule
  FROM jsonb_array_elements(schedule) elem
  WHERE (elem->>'day')::integer = current_day
  AND (elem->>'enabled')::boolean = true
  LIMIT 1;
  
  IF day_schedule IS NULL THEN
    RETURN FALSE;
  END IF;
  
  IF utc_time >= (day_schedule->>'start_time') AND 
     utc_time <= (day_schedule->>'end_time') THEN
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;

-- Get next task optimized
CREATE OR REPLACE FUNCTION public.get_next_task_optimized(p_user_id UUID)
RETURNS TABLE(task_id UUID, prompt TEXT, response_a TEXT, response_b TEXT, category TEXT, difficulty task_difficulty, created_at TIMESTAMPTZ, available_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_available_count
  FROM ai_tasks t
  WHERE t.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM task_completions tc
    WHERE tc.user_id = p_user_id
    AND tc.task_id = t.id
  );

  RETURN QUERY
  SELECT 
    t.id AS task_id,
    t.prompt,
    t.response_a,
    t.response_b,
    t.category,
    t.difficulty,
    t.created_at,
    v_available_count AS available_count
  FROM ai_tasks t
  WHERE t.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM task_completions tc
    WHERE tc.user_id = p_user_id
    AND tc.task_id = t.id
  )
  ORDER BY t.created_at ASC
  LIMIT 1;
END;
$$;

-- Complete task atomic
CREATE OR REPLACE FUNCTION public.complete_task_atomic(
  p_user_id UUID,
  p_task_id UUID,
  p_selected_response TEXT,
  p_time_taken_seconds INTEGER,
  p_is_correct BOOLEAN,
  p_earnings_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_plan RECORD;
  v_task RECORD;
  v_new_earnings_balance NUMERIC;
  v_new_total_earned NUMERIC;
  v_task_completion_id UUID;
  v_transaction_id UUID;
  v_result JSONB;
  v_referral RECORD;
  v_referrer_plan RECORD;
  v_referred_plan_eligible BOOLEAN;
  v_commission_rate NUMERIC := 0;
  v_commission_amount NUMERIC := 0;
  v_commission_transaction_id UUID;
  v_referral_earning_id UUID;
  v_new_referrer_balance NUMERIC;
  v_referred_username TEXT;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found', 'error_code', 'PROFILE_NOT_FOUND');
  END IF;
  
  v_referred_username := v_profile.username;
  
  SELECT * INTO v_plan FROM membership_plans WHERE name = v_profile.membership_plan AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan not found', 'error_code', 'INVALID_PLAN');
  END IF;
  
  IF v_profile.tasks_completed_today >= v_plan.daily_task_limit THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Daily limit reached',
      'error_code', 'DAILY_LIMIT_REACHED',
      'tasks_completed_today', v_profile.tasks_completed_today,
      'daily_task_limit', v_plan.daily_task_limit
    );
  END IF;
  
  SELECT * INTO v_task FROM ai_tasks WHERE id = p_task_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task not found', 'error_code', 'INVALID_TASK');
  END IF;
  
  IF EXISTS (SELECT 1 FROM task_completions WHERE user_id = p_user_id AND task_id = p_task_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already completed', 'error_code', 'DUPLICATE_SUBMISSION');
  END IF;
  
  v_new_earnings_balance := v_profile.earnings_wallet_balance + p_earnings_amount;
  v_new_total_earned := v_profile.total_earned + p_earnings_amount;
  
  INSERT INTO task_completions (user_id, task_id, selected_response, is_correct, earnings_amount, time_taken_seconds, completed_at)
  VALUES (p_user_id, p_task_id, p_selected_response, p_is_correct, p_earnings_amount, p_time_taken_seconds, NOW())
  RETURNING id INTO v_task_completion_id;
  
  IF p_earnings_amount > 0 THEN
    INSERT INTO transactions (user_id, type, amount, wallet_type, status, new_balance, description, metadata, created_at)
    VALUES (
      p_user_id, 'task_earning', p_earnings_amount, 'earnings', 'completed', v_new_earnings_balance,
      'Earned from completing AI training task',
      jsonb_build_object('task_id', p_task_id, 'task_completion_id', v_task_completion_id, 'is_correct', p_is_correct),
      NOW()
    ) RETURNING id INTO v_transaction_id;
  END IF;
  
  UPDATE profiles
  SET tasks_completed_today = tasks_completed_today + 1,
      earnings_wallet_balance = v_new_earnings_balance,
      total_earned = v_new_total_earned,
      last_task_date = CURRENT_DATE,
      last_activity = NOW()
  WHERE id = p_user_id;
  
  -- Commission processing
  IF p_earnings_amount > 0 THEN
    SELECT mp.referral_eligible INTO v_referred_plan_eligible
    FROM membership_plans mp
    WHERE mp.name = v_profile.membership_plan
    LIMIT 1;
    
    IF v_referred_plan_eligible = true THEN
      SELECT * INTO v_referral FROM referrals WHERE referred_id = p_user_id AND status = 'active' LIMIT 1;
      
      IF v_referral.id IS NOT NULL THEN
        SELECT mp.name, mp.task_commission_rate, mp.account_type
        INTO v_referrer_plan
        FROM profiles p
        INNER JOIN membership_plans mp ON mp.name = p.membership_plan
        WHERE p.id = v_referral.referrer_id AND mp.is_active = true;
        
        IF v_referrer_plan.name IS NOT NULL AND v_referrer_plan.account_type != 'free' AND v_referrer_plan.task_commission_rate > 0 THEN
          v_commission_rate := v_referrer_plan.task_commission_rate;
          v_commission_amount := ROUND(p_earnings_amount * v_commission_rate, 4);
          
          SELECT earnings_wallet_balance INTO v_new_referrer_balance
          FROM profiles WHERE id = v_referral.referrer_id FOR UPDATE;
          
          v_new_referrer_balance := v_new_referrer_balance + v_commission_amount;
          
          UPDATE profiles
          SET earnings_wallet_balance = v_new_referrer_balance,
              total_earned = total_earned + v_commission_amount,
              last_activity = NOW()
          WHERE id = v_referral.referrer_id;
          
          INSERT INTO transactions (user_id, type, amount, wallet_type, new_balance, status, description, metadata, created_at)
          VALUES (
            v_referral.referrer_id, 'referral_commission', v_commission_amount, 'earnings', v_new_referrer_balance, 'completed',
            'Referral commission from task completion: ' || v_referred_username,
            jsonb_build_object('source_event', 'task_completion', 'referred_user_id', p_user_id, 'base_amount', p_earnings_amount, 'commission_rate', v_commission_rate),
            NOW()
          ) RETURNING id INTO v_commission_transaction_id;
          
          INSERT INTO referral_earnings (referrer_id, referred_user_id, earning_type, base_amount, commission_rate, commission_amount, metadata, created_at)
          VALUES (v_referral.referrer_id, p_user_id, 'task_commission', p_earnings_amount, v_commission_rate, v_commission_amount, jsonb_build_object('task_id', p_task_id), NOW())
          RETURNING id INTO v_referral_earning_id;
          
          UPDATE referrals
          SET total_commission_earned = total_commission_earned + v_commission_amount, last_commission_date = NOW()
          WHERE id = v_referral.id;
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'task_completion_id', v_task_completion_id,
    'transaction_id', v_transaction_id,
    'is_correct', p_is_correct,
    'earnings_amount', p_earnings_amount,
    'new_earnings_balance', v_new_earnings_balance,
    'tasks_completed_today', v_profile.tasks_completed_today + 1,
    'daily_task_limit', v_plan.daily_task_limit,
    'commission_processed', v_commission_amount > 0,
    'commission_amount', v_commission_amount
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'error_code', 'TRANSACTION_FAILED');
END;
$$;

-- Process withdrawal request atomic
CREATE OR REPLACE FUNCTION public.process_withdrawal_request_atomic(
  p_user_id UUID,
  p_amount NUMERIC,
  p_fee NUMERIC,
  p_net_amount NUMERIC,
  p_payout_address TEXT,
  p_payment_method TEXT,
  p_payment_processor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_withdrawal_request_id UUID;
  v_transaction_id UUID;
BEGIN
  SELECT earnings_wallet_balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found', 'error_code', 'PROFILE_NOT_FOUND');
  END IF;
  
  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance', 'error_code', 'INSUFFICIENT_BALANCE');
  END IF;
  
  v_new_balance := v_current_balance - p_amount;
  
  UPDATE profiles SET earnings_wallet_balance = v_new_balance, last_activity = NOW() WHERE id = p_user_id;
  
  INSERT INTO withdrawal_requests (user_id, amount, fee, net_amount, payout_address, payment_method, payment_processor_id, status, created_at)
  VALUES (p_user_id, p_amount, p_fee, p_net_amount, p_payout_address, p_payment_method, p_payment_processor_id, 'pending', NOW())
  RETURNING id INTO v_withdrawal_request_id;
  
  INSERT INTO transactions (user_id, type, amount, wallet_type, new_balance, status, description, payment_gateway, metadata, created_at)
  VALUES (p_user_id, 'withdrawal', p_amount, 'earnings', v_new_balance, 'pending', 'Withdrawal request created', p_payment_method,
    jsonb_build_object('withdrawal_request_id', v_withdrawal_request_id, 'fee', p_fee, 'net_amount', p_net_amount, 'payout_address', p_payout_address), NOW())
  RETURNING id INTO v_transaction_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'withdrawal_request_id', v_withdrawal_request_id,
    'transaction_id', v_transaction_id,
    'old_balance', v_current_balance,
    'new_balance', v_new_balance,
    'amount_withdrawn', p_amount
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'error_code', 'TRANSACTION_FAILED');
END;
$$;

-- Process plan upgrade atomic
CREATE OR REPLACE FUNCTION public.process_plan_upgrade_atomic(
  p_user_id UUID,
  p_plan_name TEXT,
  p_final_cost NUMERIC,
  p_expiry_date TIMESTAMPTZ,
  p_previous_plan TEXT DEFAULT 'free',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_deposit_balance NUMERIC;
  v_new_deposit_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  SELECT deposit_wallet_balance INTO v_current_deposit_balance
  FROM profiles WHERE id = p_user_id FOR UPDATE;
  
  IF v_current_deposit_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found', 'error_code', 'PROFILE_NOT_FOUND');
  END IF;
  
  IF v_current_deposit_balance < p_final_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance', 'error_code', 'INSUFFICIENT_BALANCE');
  END IF;
  
  v_new_deposit_balance := v_current_deposit_balance - p_final_cost;
  
  UPDATE profiles
  SET membership_plan = p_plan_name, plan_expires_at = p_expiry_date, current_plan_start_date = NOW(),
      deposit_wallet_balance = v_new_deposit_balance, last_activity = NOW()
  WHERE id = p_user_id;
  
  INSERT INTO transactions (user_id, type, amount, wallet_type, new_balance, status, description, metadata, created_at)
  VALUES (p_user_id, 'plan_upgrade', p_final_cost, 'deposit', v_new_deposit_balance, 'completed', 'Upgraded to ' || p_plan_name || ' plan', p_metadata, NOW())
  RETURNING id INTO v_transaction_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'old_deposit_balance', v_current_deposit_balance,
    'new_deposit_balance', v_new_deposit_balance,
    'plan_name', p_plan_name,
    'expires_at', p_expiry_date
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'error_code', 'TRANSACTION_FAILED');
END;
$$;

-- Credit deposit simple v3
CREATE OR REPLACE FUNCTION public.credit_deposit_simple_v3(
  p_user_id UUID,
  p_amount NUMERIC,
  p_tracking_id TEXT,
  p_payment_id TEXT,
  p_payment_method TEXT DEFAULT 'cpay',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
  v_existing_tx UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be null';
  END IF;
  
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  
  IF p_tracking_id IS NOT NULL THEN
    SELECT id INTO v_existing_tx
    FROM transactions
    WHERE user_id = p_user_id AND type = 'deposit' AND metadata->>'tracking_id' = p_tracking_id
    LIMIT 1;
    
    IF v_existing_tx IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'duplicate_transaction', 'existing_transaction_id', v_existing_tx);
    END IF;
  END IF;
  
  SELECT deposit_wallet_balance INTO v_current_balance FROM profiles WHERE id = p_user_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
  
  v_new_balance := v_current_balance + p_amount;
  
  UPDATE profiles SET deposit_wallet_balance = v_new_balance, last_activity = NOW() WHERE id = p_user_id;
  
  INSERT INTO transactions (user_id, type, amount, wallet_type, status, payment_gateway, gateway_transaction_id, new_balance, metadata, created_at)
  VALUES (p_user_id, 'deposit', p_amount, 'deposit', 'completed', p_payment_method, p_payment_id, v_new_balance,
    jsonb_build_object('tracking_id', p_tracking_id, 'payment_method', p_payment_method, 'payment_id', p_payment_id), NOW())
  RETURNING id INTO v_transaction_id;
  
  RETURN jsonb_build_object('success', true, 'transaction_id', v_transaction_id, 'new_balance', v_new_balance, 'amount_credited', p_amount);
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'error_code', SQLSTATE);
END;
$$;

-- Generate voucher code
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
    v_code := 'FE-' || 
              UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 4)) || '-' ||
              UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 4)) || '-' ||
              UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 4));
    
    SELECT EXISTS(SELECT 1 FROM public.vouchers WHERE voucher_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_code;
END;
$$;

-- Get partner commission rate
CREATE OR REPLACE FUNCTION public.get_partner_commission_rate(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_config RECORD;
  v_rank_commission NUMERIC;
BEGIN
  SELECT * INTO v_partner_config FROM public.partner_config WHERE user_id = p_user_id LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN 0.10;
  END IF;
  
  IF v_partner_config.use_global_commission THEN
    SELECT commission_rate INTO v_rank_commission FROM public.partner_ranks WHERE rank_name = v_partner_config.current_rank LIMIT 1;
    RETURN COALESCE(v_rank_commission, 0.10);
  ELSE
    RETURN v_partner_config.commission_rate;
  END IF;
END;
$$;

-- Update partner rank
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
  SELECT daily_sales, current_rank INTO v_daily_sales, v_old_rank FROM public.partner_config WHERE user_id = p_partner_id LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  SELECT rank_name INTO v_new_rank FROM public.partner_ranks WHERE daily_sales_target <= v_daily_sales ORDER BY rank_order DESC LIMIT 1;
  v_new_rank := COALESCE(v_new_rank, 'bronze');
  
  IF v_new_rank != v_old_rank THEN
    UPDATE public.partner_config SET current_rank = v_new_rank, updated_at = NOW() WHERE user_id = p_partner_id;
    
    INSERT INTO public.partner_activity_log (partner_id, activity_type, details)
    VALUES (p_partner_id, 'rank_updated', jsonb_build_object('old_rank', v_old_rank, 'new_rank', v_new_rank, 'daily_sales', v_daily_sales));
  END IF;
  
  RETURN v_new_rank;
END;
$$;

-- Refresh materialized views
CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_user_referral_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_platform_stats;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error refreshing materialized views: %', SQLERRM;
END;
$$;

-- Get referrals with details
CREATE OR REPLACE FUNCTION public.get_referrals_with_details(p_referrer_id UUID, p_limit INTEGER DEFAULT 20, p_offset INTEGER DEFAULT 0)
RETURNS TABLE(id UUID, referred_id UUID, username TEXT, email TEXT, membership_plan TEXT, account_status account_status, total_commission_earned NUMERIC, status TEXT, created_at TIMESTAMPTZ, last_activity TIMESTAMPTZ, total_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id, r.referred_id, p.username, p.email, p.membership_plan, p.account_status,
    r.total_commission_earned, r.status, r.created_at, p.last_activity,
    COUNT(*) OVER() AS total_count
  FROM referrals r
  INNER JOIN profiles p ON p.id = r.referred_id
  WHERE r.referrer_id = p_referrer_id
  ORDER BY r.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- ============================================================================
-- SECTION 8: MATERIALIZED VIEWS
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_user_referral_stats AS
SELECT 
  p.id as user_id,
  p.username,
  COUNT(r.id) as total_referrals,
  COUNT(r.id) FILTER (WHERE r.status = 'active') as active_referrals,
  COALESCE(SUM(r.total_commission_earned), 0) as total_commission
FROM profiles p
LEFT JOIN referrals r ON r.referrer_id = p.id
GROUP BY p.id, p.username;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_referral_stats_user_id ON public.mv_user_referral_stats(user_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_platform_stats AS
SELECT 
  COUNT(DISTINCT p.id) as total_users,
  COUNT(DISTINCT p.id) FILTER (WHERE p.last_activity > NOW() - INTERVAL '30 days') as active_users,
  COUNT(DISTINCT tc.id) as total_tasks_completed,
  COUNT(DISTINCT r.id) as total_referrals,
  COALESCE(SUM(p.deposit_wallet_balance + p.earnings_wallet_balance), 0) as total_value_locked
FROM profiles p
LEFT JOIN task_completions tc ON tc.user_id = p.id
LEFT JOIN referrals r ON r.referrer_id = p.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_platform_stats ON public.mv_platform_stats((1));

-- ============================================================================
-- SECTION 9: TRIGGERS
-- ============================================================================

-- Updated at triggers
CREATE TRIGGER update_membership_plans_updated_at
  BEFORE UPDATE ON public.membership_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_platform_config_updated_at
  BEFORE UPDATE ON public.platform_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_processors_updated_at
  BEFORE UPDATE ON public.payment_processors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partner_config_updated_at
  BEFORE UPDATE ON public.partner_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partner_onboarding_updated_at
  BEFORE UPDATE ON public.partner_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Profile update validation trigger
CREATE TRIGGER validate_profile_update_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_update();

-- ============================================================================
-- SECTION 10: ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_program_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_processors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_email_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verification_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verification_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_deletion_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_login_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reset_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_function_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_pool_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cpay_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_account_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.how_it_works_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.how_it_works_pdf_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_debug_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_bonus_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_weekly_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 11: RLS POLICIES
-- ============================================================================

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can check username availability" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can view their upline profile" ON public.profiles FOR SELECT USING (id IN (SELECT referrer_id FROM referrals WHERE referred_id = auth.uid() AND status = 'active'));

-- User roles policies
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Membership plans policies
CREATE POLICY "Anyone can view active membership plans" ON public.membership_plans FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage membership plans" ON public.membership_plans FOR ALL USING (has_role(auth.uid(), 'admin'));

-- AI tasks policies
CREATE POLICY "Anyone can view active AI tasks" ON public.ai_tasks FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage AI tasks" ON public.ai_tasks FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Task completions policies
CREATE POLICY "Users can view their own task completions" ON public.task_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own task completions" ON public.task_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all task completions" ON public.task_completions FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Transactions policies
CREATE POLICY "Users can view their own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all transactions" ON public.transactions FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage transactions" ON public.transactions FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role can insert transactions" ON public.transactions FOR INSERT WITH CHECK (true);

-- Referrals policies
CREATE POLICY "Users can view their own referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
CREATE POLICY "Admins can view all referrals" ON public.referrals FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role can insert referrals" ON public.referrals FOR INSERT WITH CHECK (true);

-- Referral earnings policies
CREATE POLICY "Users can view their own referral earnings" ON public.referral_earnings FOR SELECT USING (auth.uid() = referrer_id);
CREATE POLICY "Admins can view all referral earnings" ON public.referral_earnings FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage referral earnings" ON public.referral_earnings FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Withdrawal requests policies
CREATE POLICY "Users can view their own withdrawal requests" ON public.withdrawal_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own withdrawal requests" ON public.withdrawal_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all withdrawal requests" ON public.withdrawal_requests FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage withdrawal requests" ON public.withdrawal_requests FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Payment processors policies
CREATE POLICY "Anyone can view active payment processors" ON public.payment_processors FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage payment processors" ON public.payment_processors FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Platform config policies
CREATE POLICY "Anyone can view platform config" ON public.platform_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage platform config" ON public.platform_config FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Notifications policies
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all notifications" ON public.notifications FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- Audit logs policies
CREATE POLICY "Admins can view all audit logs" ON public.audit_logs FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

-- Email templates policies
CREATE POLICY "Admins can manage email templates" ON public.email_templates FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Email logs policies
CREATE POLICY "Admins can view email logs" ON public.email_logs FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert email logs" ON public.email_logs FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

-- Bulk email jobs policies
CREATE POLICY "Admins can view all bulk email jobs" ON public.bulk_email_jobs FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can create bulk email jobs" ON public.bulk_email_jobs FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update bulk email jobs" ON public.bulk_email_jobs FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role can update bulk email jobs" ON public.bulk_email_jobs FOR UPDATE USING (true);

-- CPAY checkouts policies
CREATE POLICY "Anyone can view active CPAY checkouts" ON public.cpay_checkouts FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage CPAY checkouts" ON public.cpay_checkouts FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Partner config policies
CREATE POLICY "Partners can view their own config" ON public.partner_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Partners can update their own payment methods" ON public.partner_config FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all partner configs" ON public.partner_config FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all partner configs" ON public.partner_config FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert partner configs" ON public.partner_config FOR INSERT WITH CHECK (true);

-- Partner ranks policies
CREATE POLICY "Anyone can view partner ranks" ON public.partner_ranks FOR SELECT USING (true);
CREATE POLICY "Admins can manage partner ranks" ON public.partner_ranks FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Partner applications policies
CREATE POLICY "Users can view their own applications" ON public.partner_applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own applications" ON public.partner_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all applications" ON public.partner_applications FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update applications" ON public.partner_applications FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- Vouchers policies
CREATE POLICY "Partners can view their own vouchers" ON public.vouchers FOR SELECT USING (auth.uid() = partner_id);
CREATE POLICY "Users can view vouchers sent to them" ON public.vouchers FOR SELECT USING (auth.uid() = recipient_user_id);
CREATE POLICY "Admins can view all vouchers" ON public.vouchers FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage vouchers" ON public.vouchers FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert vouchers" ON public.vouchers FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update vouchers" ON public.vouchers FOR UPDATE USING (true);

-- Service role policies for OTPs and tokens
CREATE POLICY "Service role manages OTPs" ON public.email_verification_otps FOR ALL USING (true);
CREATE POLICY "Service role manages deletion OTPs" ON public.account_deletion_otps FOR ALL USING (true);
CREATE POLICY "Service role can manage tokens" ON public.password_reset_tokens FOR ALL USING (true);

-- Daily reset logs policies
CREATE POLICY "Admins can view reset logs" ON public.daily_reset_logs FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role can insert reset logs" ON public.daily_reset_logs FOR INSERT WITH CHECK (true);

-- Edge function metrics policies
CREATE POLICY "Admins can view all metrics" ON public.edge_function_metrics FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role can insert metrics" ON public.edge_function_metrics FOR INSERT WITH CHECK (true);

-- Commission audit log policies
CREATE POLICY "Admins can view audit logs" ON public.commission_audit_log FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role can insert audit logs" ON public.commission_audit_log FOR INSERT WITH CHECK (true);

-- Master login sessions policies
CREATE POLICY "Admins can manage master login sessions" ON public.master_login_sessions FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Group account config policies
CREATE POLICY "Anyone can view group account config" ON public.group_account_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage group account config" ON public.group_account_config FOR ALL USING (has_role(auth.uid(), 'admin'));

-- How it works policies
CREATE POLICY "Anyone can view active how it works steps" ON public.how_it_works_steps FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage how it works steps" ON public.how_it_works_steps FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Partner bonus tiers policies
CREATE POLICY "Anyone can view active bonus tiers" ON public.partner_bonus_tiers FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage bonus tiers" ON public.partner_bonus_tiers FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Partner weekly bonuses policies
CREATE POLICY "Partners can view their own weekly bonuses" ON public.partner_weekly_bonuses FOR SELECT USING (auth.uid() = partner_id);
CREATE POLICY "Admins can view all weekly bonuses" ON public.partner_weekly_bonuses FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update weekly bonuses" ON public.partner_weekly_bonuses FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert weekly bonuses" ON public.partner_weekly_bonuses FOR INSERT WITH CHECK (true);

-- Partner onboarding policies
CREATE POLICY "Partners can view their own onboarding" ON public.partner_onboarding FOR SELECT USING (auth.uid() = partner_id);
CREATE POLICY "Partners can update their own onboarding" ON public.partner_onboarding FOR UPDATE USING (auth.uid() = partner_id) WITH CHECK (auth.uid() = partner_id);
CREATE POLICY "Admins can view all onboarding records" ON public.partner_onboarding FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert onboarding records" ON public.partner_onboarding FOR INSERT WITH CHECK (true);

-- Partner activity log policies
CREATE POLICY "Partners can view their own activity" ON public.partner_activity_log FOR SELECT USING (auth.uid() = partner_id);
CREATE POLICY "Admins can view all activity" ON public.partner_activity_log FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert activity logs" ON public.partner_activity_log FOR INSERT WITH CHECK (true);

-- Partner debug logs policies
CREATE POLICY "Users can insert their own debug logs" ON public.partner_debug_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all debug logs" ON public.partner_debug_logs FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- User activity log policies
CREATE POLICY "Users can view their own activity log" ON public.user_activity_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all activity logs" ON public.user_activity_log FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert activity logs" ON public.user_activity_log FOR INSERT WITH CHECK (true);

-- ============================================================================
-- SECTION 12: DEFAULT DATA (Optional - Run separately if needed)
-- ============================================================================

-- Insert default membership plans
INSERT INTO public.membership_plans (name, display_name, account_type, price, daily_task_limit, earning_per_task, min_withdrawal, max_daily_withdrawal, task_commission_rate, deposit_commission_rate, referral_eligible)
VALUES 
  ('free', 'Free', 'free', 0, 5, 0.10, 10, 5, 0, 0, false),
  ('basic', 'Basic', 'personal', 25, 20, 0.50, 5, 25, 0.05, 0.05, true),
  ('premium', 'Premium', 'personal', 50, 50, 0.75, 5, 50, 0.08, 0.08, true),
  ('pro', 'Pro', 'business', 100, 100, 1.00, 5, 100, 0.10, 0.10, true)
ON CONFLICT (name) DO NOTHING;

-- Insert default partner ranks
INSERT INTO public.partner_ranks (rank_name, rank_order, daily_sales_target, commission_rate)
VALUES 
  ('bronze', 1, 0, 0.10),
  ('silver', 2, 100, 0.12),
  ('gold', 3, 500, 0.15),
  ('platinum', 4, 1000, 0.18),
  ('diamond', 5, 5000, 0.20)
ON CONFLICT (rank_name) DO NOTHING;

-- Insert default referral program config
INSERT INTO public.referral_program_config (signup_bonus_enabled, signup_bonus_amount)
VALUES (false, 0)
ON CONFLICT DO NOTHING;

-- Insert default platform config
INSERT INTO public.platform_config (key, value, description)
VALUES 
  ('payout_days', '[5]'::jsonb, 'Days of week when withdrawals are allowed (0=Sunday, 5=Friday)'),
  ('maintenance_mode', 'false'::jsonb, 'Platform maintenance mode'),
  ('welcome_bonus', '0'::jsonb, 'Welcome bonus amount for new users')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- END OF MIGRATION SCHEMA
-- ============================================================================
