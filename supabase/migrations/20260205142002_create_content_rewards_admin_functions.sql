-- Create admin functions for Content Rewards management
-- These functions allow admins to enable/disable access and get creator stats

-- Function: Admin enable content rewards for a user
CREATE OR REPLACE FUNCTION public.admin_enable_content_rewards(
  p_user_id UUID,
  p_skip_onboarding BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_result JSONB;
BEGIN
  -- Check if current user is admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unauthorized',
      'message', 'Only admins can enable content rewards'
    );
  END IF;

  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'user_not_found',
      'message', 'User not found'
    );
  END IF;

  -- Update user profile
  UPDATE public.profiles
  SET 
    content_rewards_enabled = true,
    content_rewards_status = 'approved',
    content_rewards_onboarded_at = CASE 
      WHEN p_skip_onboarding THEN content_rewards_onboarded_at 
      ELSE COALESCE(content_rewards_onboarded_at, NOW()) 
    END
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Content rewards enabled successfully',
    'user_id', p_user_id
  );
END;
$$;

-- Function: Admin disable content rewards for a user
CREATE OR REPLACE FUNCTION public.admin_disable_content_rewards(
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
  -- Check if current user is admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unauthorized',
      'message', 'Only admins can disable content rewards'
    );
  END IF;

  -- Update user profile
  UPDATE public.profiles
  SET 
    content_rewards_enabled = false,
    content_rewards_status = 'pending'
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Content rewards disabled successfully',
    'user_id', p_user_id
  );
END;
$$;

-- Function: Admin suspend content rewards for a user
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
  -- Check if current user is admin
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

  -- Update user profile
  UPDATE public.profiles
  SET 
    content_rewards_status = 'suspended'
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Content rewards suspended successfully',
    'user_id', p_user_id
  );
END;
$$;

-- Function: Get content rewards stats for a creator
CREATE OR REPLACE FUNCTION public.get_content_rewards_stats(
  p_user_id UUID,
  p_date_from TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_date_to TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_stats JSONB;
  v_date_from TIMESTAMP WITH TIME ZONE;
  v_date_to TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Set default date range if not provided
  v_date_from := COALESCE(p_date_from, NOW() - INTERVAL '30 days');
  v_date_to := COALESCE(p_date_to, NOW());

  SELECT jsonb_build_object(
    'total_clicks', (
      SELECT COUNT(*)::INTEGER
      FROM public.referral_clicks
      WHERE referrer_id = p_user_id
      AND clicked_at >= v_date_from
      AND clicked_at <= v_date_to
    ),
    'total_signups', (
      SELECT COUNT(*)::INTEGER
      FROM public.referrals
      WHERE referrer_id = p_user_id
      AND created_at >= v_date_from
      AND created_at <= v_date_to
    ),
    'total_upgrades', (
      SELECT COUNT(DISTINCT t.user_id)::INTEGER
      FROM public.transactions t
      INNER JOIN public.referrals r ON r.referred_id = t.user_id
      WHERE r.referrer_id = p_user_id
      AND t.type = 'plan_upgrade'
      AND t.created_at >= v_date_from
      AND t.created_at <= v_date_to
    ),
    'total_earnings', (
      SELECT COALESCE(SUM(commission_amount), 0)::NUMERIC
      FROM public.referral_earnings
      WHERE referrer_id = p_user_id
      AND created_at >= v_date_from
      AND created_at <= v_date_to
    ),
    'upgrade_earnings', (
      SELECT COALESCE(SUM(commission_amount), 0)::NUMERIC
      FROM public.referral_earnings re
      INNER JOIN public.transactions t ON t.metadata->>'referred_user_id' = re.referred_user_id::TEXT
      WHERE re.referrer_id = p_user_id
      AND re.earning_type LIKE '%upgrade%'
      AND re.created_at >= v_date_from
      AND re.created_at <= v_date_to
    ),
    'task_earnings', (
      SELECT COALESCE(SUM(commission_amount), 0)::NUMERIC
      FROM public.referral_earnings
      WHERE referrer_id = p_user_id
      AND earning_type LIKE '%task%'
      AND created_at >= v_date_from
      AND created_at <= v_date_to
    )
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.admin_enable_content_rewards(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_disable_content_rewards(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_suspend_content_rewards(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_content_rewards_stats(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;
