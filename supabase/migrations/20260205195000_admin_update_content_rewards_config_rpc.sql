-- RPC to update Content Rewards config so save works regardless of RLS on platform_config.
-- Uses SECURITY DEFINER so the update runs with elevated privileges after admin check.

CREATE OR REPLACE FUNCTION public.admin_update_content_rewards_config(p_value jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can update Content Rewards config';
  END IF;

  INSERT INTO public.platform_config (key, value, description, updated_at)
  VALUES (
    'content_rewards_config',
    p_value,
    'Content Rewards Program configuration. Editable from admin panel.',
    now()
  )
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = EXCLUDED.updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_content_rewards_config(jsonb) TO authenticated;
COMMENT ON FUNCTION public.admin_update_content_rewards_config(jsonb) IS 'Admin-only: upsert content_rewards_config in platform_config. Use when direct table update fails due to RLS.';
