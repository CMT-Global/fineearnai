-- task_manager_4opt enum value is added in 20260217115500_add_task_manager_4opt_enum.sql
-- (PostgreSQL requires enum values to be committed before use in the same session)

-- Create ai_tasks_4opt table for 4-option AI questions
-- Separate from ai_tasks (2-option) - no modifications to existing tables
CREATE TABLE IF NOT EXISTS public.ai_tasks_4opt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt TEXT NOT NULL,
  response_a TEXT NOT NULL,
  response_b TEXT NOT NULL,
  response_c TEXT NOT NULL,
  response_d TEXT NOT NULL,
  correct_response TEXT NOT NULL CHECK (correct_response IN ('a', 'b', 'c', 'd')),
  category TEXT NOT NULL,
  difficulty task_difficulty NOT NULL DEFAULT 'medium',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  prompt_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task_completions_4opt table
CREATE TABLE IF NOT EXISTS public.task_completions_4opt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.ai_tasks_4opt(id) ON DELETE CASCADE,
  selected_response TEXT NOT NULL CHECK (selected_response IN ('a', 'b', 'c', 'd')),
  is_correct BOOLEAN NOT NULL,
  earnings_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  time_taken_seconds INTEGER NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, task_id)
);

-- Enable RLS
ALTER TABLE public.ai_tasks_4opt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions_4opt ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_tasks_4opt
DROP POLICY IF EXISTS "Anyone can view active AI tasks 4opt" ON public.ai_tasks_4opt;
CREATE POLICY "Anyone can view active AI tasks 4opt"
  ON public.ai_tasks_4opt
  FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage AI tasks 4opt" ON public.ai_tasks_4opt;
CREATE POLICY "Admins can manage AI tasks 4opt"
  ON public.ai_tasks_4opt
  FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'task_manager_4opt'));

-- RLS Policies for task_completions_4opt
DROP POLICY IF EXISTS "Users can view their own completions 4opt" ON public.task_completions_4opt;
CREATE POLICY "Users can view their own completions 4opt"
  ON public.task_completions_4opt
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own completions 4opt" ON public.task_completions_4opt;
CREATE POLICY "Users can insert their own completions 4opt"
  ON public.task_completions_4opt
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all completions 4opt" ON public.task_completions_4opt;
CREATE POLICY "Admins can view all completions 4opt"
  ON public.task_completions_4opt
  FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'task_manager_4opt'));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_tasks_4opt_category ON public.ai_tasks_4opt(category);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_4opt_difficulty ON public.ai_tasks_4opt(difficulty);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_4opt_is_active ON public.ai_tasks_4opt(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_4opt_created_at ON public.ai_tasks_4opt(created_at);
CREATE INDEX IF NOT EXISTS idx_task_completions_4opt_user_id ON public.task_completions_4opt(user_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_4opt_task_id ON public.task_completions_4opt(task_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_4opt_completed_at ON public.task_completions_4opt(completed_at);

-- Get next 4-option task optimized
CREATE OR REPLACE FUNCTION public.get_next_task_4opt_optimized(p_user_id UUID)
RETURNS TABLE (
  task_id UUID,
  prompt TEXT,
  response_a TEXT,
  response_b TEXT,
  response_c TEXT,
  response_d TEXT,
  category TEXT,
  difficulty task_difficulty,
  created_at TIMESTAMP WITH TIME ZONE,
  available_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_available_count
  FROM ai_tasks_4opt t
  WHERE t.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM task_completions_4opt tc
    WHERE tc.user_id = p_user_id
    AND tc.task_id = t.id
  );

  RETURN QUERY
  SELECT 
    t.id AS task_id,
    t.prompt,
    t.response_a,
    t.response_b,
    t.response_c,
    t.response_d,
    t.category,
    t.difficulty,
    t.created_at,
    v_available_count AS available_count
  FROM ai_tasks_4opt t
  WHERE t.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM task_completions_4opt tc
    WHERE tc.user_id = p_user_id
    AND tc.task_id = t.id
  )
  ORDER BY t.created_at ASC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_next_task_4opt_optimized(UUID) IS 'Returns next available 4-option task for a user. Used by get-next-task-4opt edge function.';

GRANT EXECUTE ON FUNCTION public.get_next_task_4opt_optimized(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_task_4opt_optimized(UUID) TO service_role;

-- Complete 4-option task atomic (mirrors complete_task_atomic for ai_tasks_4opt / task_completions_4opt)
CREATE OR REPLACE FUNCTION public.complete_task_4opt_atomic(
  p_user_id uuid,
  p_task_id uuid,
  p_selected_response text,
  p_time_taken_seconds integer,
  p_is_correct boolean,
  p_earnings_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_profile RECORD;
  v_plan RECORD;
  v_task RECORD;
  v_new_earnings_balance NUMERIC;
  v_new_total_earned NUMERIC;
  v_task_completion_id UUID;
  v_transaction_id UUID := NULL;
  v_commission_amount NUMERIC := 0;
  v_commission_transaction_id UUID := NULL;
  v_referral_earning_id UUID := NULL;
  v_referral RECORD;
  v_referrer_plan RECORD;
  v_referred_plan_eligible BOOLEAN;
  v_commission_rate NUMERIC := 0;
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
      'success', false, 'error', 'Daily limit reached', 'error_code', 'DAILY_LIMIT_REACHED',
      'tasks_completed_today', v_profile.tasks_completed_today, 'daily_task_limit', v_plan.daily_task_limit
    );
  END IF;

  SELECT * INTO v_task FROM ai_tasks_4opt WHERE id = p_task_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task not found', 'error_code', 'INVALID_TASK');
  END IF;

  IF EXISTS (SELECT 1 FROM task_completions_4opt WHERE user_id = p_user_id AND task_id = p_task_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already completed', 'error_code', 'DUPLICATE_SUBMISSION');
  END IF;

  v_new_earnings_balance := v_profile.earnings_wallet_balance + p_earnings_amount;
  v_new_total_earned := v_profile.total_earned + p_earnings_amount;

  INSERT INTO task_completions_4opt (user_id, task_id, selected_response, is_correct, earnings_amount, time_taken_seconds, completed_at)
  VALUES (p_user_id, p_task_id, p_selected_response, p_is_correct, p_earnings_amount, p_time_taken_seconds, NOW())
  RETURNING id INTO v_task_completion_id;

  IF p_earnings_amount > 0 THEN
    INSERT INTO transactions (user_id, type, amount, wallet_type, status, new_balance, description, metadata, created_at)
    VALUES (
      p_user_id, 'task_earning', p_earnings_amount, 'earnings', 'completed', v_new_earnings_balance,
      'Earned from completing 4-option AI training task',
      jsonb_build_object('task_id', p_task_id, 'task_source', 'ai_tasks_4opt', 'task_completion_id', v_task_completion_id, 'is_correct', p_is_correct, 'time_taken_seconds', p_time_taken_seconds),
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

  IF p_earnings_amount > 0 THEN
    SELECT mp.referral_eligible INTO v_referred_plan_eligible
    FROM membership_plans mp WHERE mp.name = v_profile.membership_plan LIMIT 1;

    IF v_referred_plan_eligible = true THEN
      SELECT * INTO v_referral FROM referrals WHERE referred_id = p_user_id AND status = 'active' LIMIT 1;

      IF v_referral.id IS NOT NULL THEN
        SELECT mp.name, mp.task_commission_rate, mp.deposit_commission_rate, mp.account_type, mp.referral_eligible
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
            'Referral commission from 4-option task completion: ' || v_referred_username,
            jsonb_build_object('source_event', 'task_completion_4opt', 'referred_user_id', p_user_id, 'task_id', p_task_id, 'task_completion_id', v_task_completion_id, 'base_amount', p_earnings_amount, 'commission_rate', v_commission_rate),
            NOW()
          ) RETURNING id INTO v_commission_transaction_id;

          INSERT INTO referral_earnings (referrer_id, referred_user_id, earning_type, base_amount, commission_rate, commission_amount, metadata, created_at)
          VALUES (
            v_referral.referrer_id, p_user_id, 'task_commission', p_earnings_amount, v_commission_rate, v_commission_amount,
            jsonb_build_object('task_source', 'ai_tasks_4opt', 'task_id', p_task_id, 'task_completion_id', v_task_completion_id),
            NOW()
          ) RETURNING id INTO v_referral_earning_id;

          UPDATE referrals SET total_commission_earned = total_commission_earned + v_commission_amount, last_commission_date = NOW() WHERE id = v_referral.id;
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
    'new_total_earned', v_new_total_earned,
    'tasks_completed_today', v_profile.tasks_completed_today + 1,
    'daily_task_limit', v_plan.daily_task_limit,
    'remaining_tasks', v_plan.daily_task_limit - (v_profile.tasks_completed_today + 1),
    'commission_processed', v_commission_amount > 0,
    'commission_amount', v_commission_amount,
    'commission_transaction_id', v_commission_transaction_id,
    'referral_earning_id', v_referral_earning_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'error_code', 'TRANSACTION_FAILED');
END;
$function$;

COMMENT ON FUNCTION public.complete_task_4opt_atomic IS 'Atomic task completion for 4-option tasks with commission processing.';

GRANT EXECUTE ON FUNCTION public.complete_task_4opt_atomic(uuid, uuid, text, integer, boolean, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_task_4opt_atomic(uuid, uuid, text, integer, boolean, numeric) TO service_role;
