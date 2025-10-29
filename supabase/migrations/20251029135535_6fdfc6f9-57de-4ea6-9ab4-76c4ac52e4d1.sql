CREATE OR REPLACE FUNCTION public.process_commission_atomic(
  p_referrer_id uuid,
  p_commission_amount numeric,
  p_referred_user_id uuid,
  p_event_type text,
  p_base_amount numeric,
  p_commission_rate numeric,
  p_metadata jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new_balance NUMERIC;
  v_result JSONB;
BEGIN
  -- Update referrer balance (row-level lock prevents race conditions)
  UPDATE public.profiles 
  SET 
    earnings_wallet_balance = earnings_wallet_balance + p_commission_amount,
    total_earned = total_earned + p_commission_amount
  WHERE id = p_referrer_id
  RETURNING earnings_wallet_balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'Referrer profile not found: %', p_referrer_id;
  END IF;

  -- Insert referral earning record
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
    p_event_type || '_commission',
    p_base_amount, 
    p_commission_amount,
    p_commission_rate, 
    p_metadata
  );

  -- Insert transaction record with username in description
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
    'referral_commission', 
    p_commission_amount,
    'earnings', 
    'completed', 
    v_new_balance, 
    p_metadata,
    'Commission from ' || p_event_type || ' by referral' || 
      CASE WHEN p_metadata->>'username' IS NOT NULL 
        THEN ': ' || (p_metadata->>'username') 
        ELSE '' 
      END
  );

  -- Update referrals summary table
  UPDATE public.referrals
  SET 
    total_commission_earned = total_commission_earned + p_commission_amount,
    last_commission_date = now()
  WHERE referrer_id = p_referrer_id AND referred_id = p_referred_user_id;

  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'commission_amount', p_commission_amount
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- Return error result
  v_result := jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
  RETURN v_result;
END;
$function$;