-- When suspending a user from Content Rewards, also set their account_status to 'suspended'
-- so they appear as suspended in the admin Users table.
CREATE OR REPLACE FUNCTION public.admin_suspend_content_rewards(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unauthorized',
      'message', 'Only admins can suspend content rewards'
    );
  END IF;

  UPDATE public.profiles
  SET 
    content_rewards_status = 'suspended',
    account_status = 'suspended'
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Content rewards suspended successfully',
    'user_id', p_user_id
  );
END;
$$;
