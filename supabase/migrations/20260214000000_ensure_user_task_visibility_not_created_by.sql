-- Ensure regular users can see tasks: created_by is for admin "Manage Tasks" UI only.
-- User-facing task fetch (get-next-task → get_next_task_optimized) must return ALL active
-- tasks not yet completed by the user; it must NOT filter by created_by.

-- 1) Re-assert RLS: "Anyone can view active AI tasks" (no created_by restriction).
--    If this policy was replaced with a created_by-based one, this restores correct behavior.
DROP POLICY IF EXISTS "Anyone can view active AI tasks" ON public.ai_tasks;
CREATE POLICY "Anyone can view active AI tasks"
  ON public.ai_tasks
  FOR SELECT
  USING (is_active = true);

-- 2) Document get_next_task_optimized: do not add created_by filter for end-users.
COMMENT ON FUNCTION public.get_next_task_optimized(UUID) IS
  'Returns next available active task for a user (excludes already completed). Used by get-next-task edge function for all end-users. Do NOT filter by created_by—created_by is for admin Manage Tasks UI only.';
