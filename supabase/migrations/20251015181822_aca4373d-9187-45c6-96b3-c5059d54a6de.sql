-- Create function to get next available task for a user
CREATE OR REPLACE FUNCTION get_next_available_task(p_user_id UUID)
RETURNS TABLE (
  task_id UUID,
  prompt TEXT,
  response_a TEXT,
  response_b TEXT,
  category TEXT,
  difficulty task_difficulty,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.prompt,
    t.response_a,
    t.response_b,
    t.category,
    t.difficulty,
    t.created_at
  FROM ai_tasks t
  WHERE t.is_active = true
  AND t.id NOT IN (
    SELECT task_id 
    FROM task_completions 
    WHERE user_id = p_user_id
  )
  ORDER BY t.created_at ASC
  LIMIT 1;
END;
$$;

-- Create function to get count of available tasks for a user
CREATE OR REPLACE FUNCTION get_available_task_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM ai_tasks t
  WHERE t.is_active = true
  AND t.id NOT IN (
    SELECT task_id 
    FROM task_completions 
    WHERE user_id = p_user_id
  );
  
  RETURN v_count;
END;
$$;