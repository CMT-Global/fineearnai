-- Self-service onboarding: any authenticated user can complete Content Rewards onboarding (auto-approve).
CREATE OR REPLACE FUNCTION public.complete_content_rewards_onboarding()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized', 'message', 'You must be logged in.');
  END IF;

  UPDATE public.profiles
  SET
    content_rewards_enabled = true,
    content_rewards_status = 'approved',
    content_rewards_onboarded_at = COALESCE(content_rewards_onboarded_at, NOW())
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Content Rewards onboarding complete. You are approved.',
    'user_id', v_user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_content_rewards_onboarding() TO authenticated;
