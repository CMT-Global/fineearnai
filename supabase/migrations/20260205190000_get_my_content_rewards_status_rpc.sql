-- Returns the current user's content rewards status from the DB (server-side, no RLS/cache issues).
-- Use this on the creator dashboard to decide access so admin-enable is always reflected.

CREATE OR REPLACE FUNCTION public.get_my_content_rewards_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid;
  v_enabled boolean;
  v_status text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('content_rewards_enabled', false, 'content_rewards_status', 'pending', 'error', 'not_authenticated');
  END IF;

  SELECT content_rewards_enabled, COALESCE(content_rewards_status, 'pending')
  INTO v_enabled, v_status
  FROM public.profiles
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('content_rewards_enabled', false, 'content_rewards_status', 'pending', 'error', 'profile_not_found');
  END IF;

  RETURN jsonb_build_object(
    'content_rewards_enabled', COALESCE(v_enabled, false),
    'content_rewards_status', COALESCE(v_status, 'pending')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_content_rewards_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_content_rewards_status() TO anon;

COMMENT ON FUNCTION public.get_my_content_rewards_status IS 'Returns current user content rewards status from DB; use for creator dashboard access check.';
