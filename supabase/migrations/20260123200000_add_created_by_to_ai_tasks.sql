-- Add created_by field to ai_tasks table to track which admin user generated each task
ALTER TABLE public.ai_tasks 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for efficient filtering by creator
CREATE INDEX IF NOT EXISTS idx_ai_tasks_created_by 
ON public.ai_tasks(created_by);

-- Add comment for documentation
COMMENT ON COLUMN public.ai_tasks.created_by IS 'UUID of the admin user who generated this task';
