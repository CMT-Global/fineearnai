-- ============================================
-- PHASE 6: EDGE FUNCTION OPTIMIZATION
-- ============================================

-- Create optimized single-query function for referrals with pagination
CREATE OR REPLACE FUNCTION get_referrals_with_details(
  p_referrer_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  referred_id UUID,
  username TEXT,
  email TEXT,
  membership_plan TEXT,
  account_status account_status,
  total_commission_earned NUMERIC,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  last_activity TIMESTAMP WITH TIME ZONE,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.referred_id,
    p.username,
    p.email,
    p.membership_plan,
    p.account_status,
    r.total_commission_earned,
    r.status,
    r.created_at,
    p.last_activity,
    COUNT(*) OVER() AS total_count
  FROM referrals r
  INNER JOIN profiles p ON p.id = r.referred_id
  WHERE r.referrer_id = p_referrer_id
  ORDER BY r.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_referrals_with_details TO authenticated;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_created 
  ON referrals(referrer_id, created_at DESC);

-- Create optimized function for next task retrieval
CREATE OR REPLACE FUNCTION get_next_task_optimized(p_user_id UUID)
RETURNS TABLE (
  task_id UUID,
  prompt TEXT,
  response_a TEXT,
  response_b TEXT,
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
  -- Get count of available tasks
  SELECT COUNT(*)
  INTO v_available_count
  FROM ai_tasks t
  WHERE t.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM task_completions tc
    WHERE tc.user_id = p_user_id
    AND tc.task_id = t.id
  );

  -- Return next task with count
  RETURN QUERY
  SELECT 
    t.id AS task_id,
    t.prompt,
    t.response_a,
    t.response_b,
    t.category,
    t.difficulty,
    t.created_at,
    v_available_count AS available_count
  FROM ai_tasks t
  WHERE t.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM task_completions tc
    WHERE tc.user_id = p_user_id
    AND tc.task_id = t.id
  )
  ORDER BY t.created_at ASC
  LIMIT 1;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_next_task_optimized TO authenticated;

COMMENT ON FUNCTION get_referrals_with_details IS 'Optimized single-query function for referrals with pagination and profile details';
COMMENT ON FUNCTION get_next_task_optimized IS 'Optimized function that returns next task and available count in single query';