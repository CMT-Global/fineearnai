-- Tag referral_commission transactions with metadata->>'source' = 'content_rewards'
-- when the referrer has content_rewards_enabled = true (Content Rewards creator).

-- 1) credit_deposit_atomic_v2: set source to content_rewards when referrer is a creator
DO $$
BEGIN
  DROP FUNCTION IF EXISTS public.credit_deposit_atomic_v2(uuid, numeric, text, text, text, jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.credit_deposit_atomic_v2(
  p_user_id uuid,
  p_amount numeric,
  p_tracking_id text,
  p_payment_id text,
  p_payment_method text DEFAULT 'cpay',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
  v_existing_tx UUID;
  v_referral RECORD;
  v_referrer_plan RECORD;
  v_commission_rate NUMERIC := 0;
  v_commission_amount NUMERIC := 0;
  v_commission_transaction_id UUID;
  v_referral_earning_id UUID;
  v_new_referrer_balance NUMERIC;
  v_referred_username TEXT;
  v_commission_source TEXT := 'deposit';
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
      RETURN jsonb_build_object('success', false, 'error', 'duplicate_transaction', 'message', 'This deposit has already been processed', 'existing_transaction_id', v_existing_tx);
    END IF;
  END IF;

  SELECT deposit_wallet_balance INTO v_current_balance FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User profile not found'; END IF;

  v_new_balance := v_current_balance + p_amount;

  UPDATE profiles SET deposit_wallet_balance = v_new_balance, last_activity = NOW() WHERE id = p_user_id;

  INSERT INTO transactions (user_id, type, amount, wallet_type, status, payment_gateway, gateway_transaction_id, new_balance, metadata)
  VALUES (p_user_id, 'deposit', p_amount, 'deposit', 'completed', p_payment_method, p_payment_id, v_new_balance,
    jsonb_build_object('tracking_id', p_tracking_id, 'payment_method', p_payment_method, 'payment_id', p_payment_id, 'additional_data', p_metadata))
  RETURNING id INTO v_transaction_id;

  SELECT * INTO v_referral FROM referrals WHERE referred_id = p_user_id AND status = 'active' ORDER BY created_at DESC LIMIT 1;

  IF v_referral IS NOT NULL THEN
    SELECT mp.name, mp.deposit_commission_rate, p.username INTO v_referrer_plan
    FROM profiles p
    INNER JOIN membership_plans mp ON mp.name = p.membership_plan
    WHERE p.id = v_referral.referrer_id AND mp.is_active = true LIMIT 1;

    IF v_referrer_plan.name IS NOT NULL AND v_referrer_plan.deposit_commission_rate IS NOT NULL AND v_referrer_plan.deposit_commission_rate > 0 THEN
      v_commission_rate := v_referrer_plan.deposit_commission_rate;
      v_commission_amount := ROUND(p_amount * v_commission_rate, 4);
      SELECT username INTO v_referred_username FROM profiles WHERE id = p_user_id;
      SELECT CASE WHEN COALESCE(content_rewards_enabled, false) THEN 'content_rewards' ELSE 'deposit' END INTO v_commission_source FROM profiles WHERE id = v_referral.referrer_id LIMIT 1;

      UPDATE profiles
      SET earnings_wallet_balance = earnings_wallet_balance + v_commission_amount, total_earned = total_earned + v_commission_amount, last_activity = NOW()
      WHERE id = v_referral.referrer_id
      RETURNING earnings_wallet_balance INTO v_new_referrer_balance;

      INSERT INTO transactions (user_id, type, amount, wallet_type, status, new_balance, metadata)
      VALUES (
        v_referral.referrer_id, 'referral_commission', v_commission_amount, 'earnings', 'completed', v_new_referrer_balance,
        jsonb_build_object(
          'commission_rate', v_commission_rate, 'base_amount', p_amount, 'referred_user_id', p_user_id, 'referred_username', v_referred_username,
          'deposit_transaction_id', v_transaction_id, 'source', v_commission_source
        )
      ) RETURNING id INTO v_commission_transaction_id;

      INSERT INTO referral_earnings (referrer_id, referred_user_id, earning_type, base_amount, commission_rate, commission_amount, metadata)
      VALUES (v_referral.referrer_id, p_user_id, 'deposit', p_amount, v_commission_rate, v_commission_amount,
        jsonb_build_object('deposit_transaction_id', v_transaction_id, 'commission_transaction_id', v_commission_transaction_id, 'referred_username', v_referred_username))
      RETURNING id INTO v_referral_earning_id;

      UPDATE referrals SET total_commission_earned = COALESCE(total_commission_earned, 0) + v_commission_amount, last_commission_at = NOW() WHERE id = v_referral.id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'transaction_id', v_transaction_id, 'new_balance', v_new_balance, 'amount_credited', p_amount,
    'commission_processed', v_commission_amount > 0, 'commission_amount', v_commission_amount,
    'commission_transaction_id', v_commission_transaction_id, 'referral_earning_id', v_referral_earning_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'error_code', SQLSTATE);
END;
$function$;

-- 2) Trigger: set metadata->>'source' = 'content_rewards' for any referral_commission when referrer is a Content Rewards creator
-- Covers complete_task_atomic and process_plan_upgrade_atomic without editing those functions.
CREATE OR REPLACE FUNCTION public.set_referral_commission_source()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_source TEXT;
BEGIN
  IF NEW.type <> 'referral_commission' THEN
    RETURN NEW;
  END IF;
  SELECT CASE WHEN COALESCE(content_rewards_enabled, false) THEN 'content_rewards' ELSE COALESCE(NEW.metadata->>'source', NEW.metadata->>'source_event', 'referral') END
  INTO v_source
  FROM profiles
  WHERE id = NEW.user_id
  LIMIT 1;
  NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object('source', COALESCE(v_source, 'referral'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_referral_commission_source ON public.transactions;
CREATE TRIGGER trigger_set_referral_commission_source
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  WHEN (NEW.type = 'referral_commission')
  EXECUTE FUNCTION public.set_referral_commission_source();
