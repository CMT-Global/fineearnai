  -- ============================================
  -- Task commission only for first N upgraded referrals
  -- When referrer's plan has max_active_referrals > 0, only the first N upgraded
  -- referrals (by referrals.created_at) generate commission; (N+1)th and beyond do not.
  -- ============================================

  -- 1) complete_task_4opt_atomic: add max_active_referrals and first-N check
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
    v_allow_commission BOOLEAN := false;
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
          SELECT mp.name, mp.task_commission_rate, mp.deposit_commission_rate, mp.account_type, mp.referral_eligible, mp.max_active_referrals
          INTO v_referrer_plan
          FROM profiles p
          INNER JOIN membership_plans mp ON mp.name = p.membership_plan
          WHERE p.id = v_referral.referrer_id AND mp.is_active = true;

          IF v_referrer_plan.name IS NOT NULL AND v_referrer_plan.account_type != 'free' AND v_referrer_plan.task_commission_rate > 0 THEN
            -- First N upgraded: only credit if this referred user is in the referrer's first max_active_referrals upgraded (by created_at)
            IF v_referrer_plan.max_active_referrals IS NULL OR v_referrer_plan.max_active_referrals <= 0 THEN
              v_allow_commission := true;
            ELSE
              SELECT EXISTS (
                SELECT 1 FROM (
                  SELECT r.referred_id
                  FROM referrals r
                  INNER JOIN profiles p ON p.id = r.referred_id
                  INNER JOIN membership_plans mp ON mp.name = p.membership_plan AND mp.is_active = true
                  WHERE r.referrer_id = v_referral.referrer_id AND r.status = 'active' AND mp.account_type <> 'free'
                  ORDER BY r.created_at
                  LIMIT v_referrer_plan.max_active_referrals
                ) AS first_n
                WHERE first_n.referred_id = p_user_id
              ) INTO v_allow_commission;
            END IF;

            IF v_allow_commission THEN
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

  COMMENT ON FUNCTION public.complete_task_4opt_atomic IS 'Atomic task completion for 4-option tasks. Commission only for first N upgraded referrals (plan max_active_referrals).';

  GRANT EXECUTE ON FUNCTION public.complete_task_4opt_atomic(uuid, uuid, text, integer, boolean, numeric) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.complete_task_4opt_atomic(uuid, uuid, text, integer, boolean, numeric) TO service_role;

  -- 2) complete_task_atomic: add max_active_referrals and first-N check (2-option tasks)
  DROP FUNCTION IF EXISTS public.complete_task_atomic(uuid, uuid, text, integer, boolean, numeric);

  CREATE OR REPLACE FUNCTION public.complete_task_atomic(
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
    v_transaction_id UUID;
    v_referral RECORD;
    v_referrer_plan RECORD;
    v_referred_plan_eligible BOOLEAN;
    v_commission_rate NUMERIC := 0;
    v_commission_amount NUMERIC := 0;
    v_commission_transaction_id UUID;
    v_referral_earning_id UUID;
    v_new_referrer_balance NUMERIC;
    v_referred_username TEXT;
    v_allow_commission BOOLEAN := false;
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
        jsonb_build_object('task_id', p_task_id, 'task_completion_id', v_task_completion_id, 'is_correct', p_is_correct, 'time_taken_seconds', p_time_taken_seconds),
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
          SELECT mp.name, mp.task_commission_rate, mp.deposit_commission_rate, mp.account_type, mp.referral_eligible, mp.max_active_referrals
          INTO v_referrer_plan
          FROM profiles p
          INNER JOIN membership_plans mp ON mp.name = p.membership_plan
          WHERE p.id = v_referral.referrer_id AND mp.is_active = true;

          IF v_referrer_plan.name IS NOT NULL AND v_referrer_plan.account_type != 'free' AND v_referrer_plan.task_commission_rate > 0 THEN
            IF v_referrer_plan.max_active_referrals IS NULL OR v_referrer_plan.max_active_referrals <= 0 THEN
              v_allow_commission := true;
            ELSE
              SELECT EXISTS (
                SELECT 1 FROM (
                  SELECT r.referred_id
                  FROM referrals r
                  INNER JOIN profiles p ON p.id = r.referred_id
                  INNER JOIN membership_plans mp ON mp.name = p.membership_plan AND mp.is_active = true
                  WHERE r.referrer_id = v_referral.referrer_id AND r.status = 'active' AND mp.account_type <> 'free'
                  ORDER BY r.created_at
                  LIMIT v_referrer_plan.max_active_referrals
                ) AS first_n
                WHERE first_n.referred_id = p_user_id
              ) INTO v_allow_commission;
            END IF;

            IF v_allow_commission THEN
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
                jsonb_build_object('source_event', 'task_completion', 'referred_user_id', p_user_id, 'task_id', p_task_id, 'task_completion_id', v_task_completion_id, 'base_amount', p_earnings_amount, 'commission_rate', v_commission_rate),
                NOW()
              ) RETURNING id INTO v_commission_transaction_id;

              INSERT INTO referral_earnings (referrer_id, referred_user_id, earning_type, base_amount, commission_rate, commission_amount, metadata, created_at)
              VALUES (
                v_referral.referrer_id, p_user_id, 'task_commission', p_earnings_amount, v_commission_rate, v_commission_amount,
                jsonb_build_object('task_id', p_task_id, 'task_completion_id', v_task_completion_id),
                NOW()
              ) RETURNING id INTO v_referral_earning_id;

              UPDATE referrals SET total_commission_earned = total_commission_earned + v_commission_amount, last_commission_date = NOW() WHERE id = v_referral.id;
            END IF;
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

  COMMENT ON FUNCTION public.complete_task_atomic IS 'Atomic task completion for 2-option tasks. Commission only for first N upgraded referrals (plan max_active_referrals).';

  GRANT EXECUTE ON FUNCTION public.complete_task_atomic(uuid, uuid, text, integer, boolean, numeric) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.complete_task_atomic(uuid, uuid, text, integer, boolean, numeric) TO service_role;
