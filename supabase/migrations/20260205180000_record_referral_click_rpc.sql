-- RPC to record a referral link click (callable by anon for landing/signup pages).
-- Resolves referrer_id from referral_code and inserts into referral_clicks with UTM params.
-- Rate limiting: optional client-side; DB does not throttle to keep RPC simple.

CREATE OR REPLACE FUNCTION public.record_referral_click(
  p_referral_code TEXT,
  p_utm_source TEXT DEFAULT NULL,
  p_utm_campaign TEXT DEFAULT NULL,
  p_utm_content TEXT DEFAULT NULL,
  p_utm_medium TEXT DEFAULT NULL,
  p_utm_term TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_referrer_id UUID;
  v_inserted_id UUID;
BEGIN
  IF p_referral_code IS NULL OR trim(p_referral_code) = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Missing referral code');
  END IF;

  SELECT id INTO v_referrer_id
  FROM public.profiles
  WHERE referral_code = trim(upper(p_referral_code))
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid referral code');
  END IF;

  INSERT INTO public.referral_clicks (
    referrer_id,
    utm_source,
    utm_campaign,
    utm_content,
    user_agent
  ) VALUES (
    v_referrer_id,
    NULLIF(trim(p_utm_source), ''),
    NULLIF(trim(p_utm_campaign), ''),
    NULLIF(trim(p_utm_content), ''),
    NULLIF(trim(p_user_agent), '')
  )
  RETURNING id INTO v_inserted_id;

  RETURN jsonb_build_object('success', true, 'id', v_inserted_id);
END;
$$;

-- Allow anon and authenticated to call (used on signup/landing)
GRANT EXECUTE ON FUNCTION public.record_referral_click(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.record_referral_click(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.record_referral_click IS 'Records a click on a creator referral link; used for Content Rewards attribution. Call from signup/landing when ref= is present.';
