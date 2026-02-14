-- Add created_by field to ai_tasks table to track which admin user generated each task.
-- IMPORTANT: created_by is used ONLY in the admin "Manage AI Tasks" UI so admins see
-- tasks they created. User-facing task fetch (get-next-task / get_next_task_optimized)
-- must NOT filter by created_by so that all users can see and complete any active task.
ALTER TABLE public.ai_tasks 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for efficient filtering by creator
CREATE INDEX IF NOT EXISTS idx_ai_tasks_created_by 
ON public.ai_tasks(created_by);

-- Add comment for documentation
COMMENT ON COLUMN public.ai_tasks.created_by IS 'UUID of the admin user who generated this task';
