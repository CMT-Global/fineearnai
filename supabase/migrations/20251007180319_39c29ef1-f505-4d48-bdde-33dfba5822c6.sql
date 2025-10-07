-- Create ai_tasks table
CREATE TABLE public.ai_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt TEXT NOT NULL,
  response_a TEXT NOT NULL,
  response_b TEXT NOT NULL,
  correct_response TEXT NOT NULL CHECK (correct_response IN ('a', 'b')),
  category TEXT NOT NULL,
  difficulty task_difficulty NOT NULL DEFAULT 'medium',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task_completions table
CREATE TABLE public.task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.ai_tasks(id) ON DELETE CASCADE,
  selected_response TEXT NOT NULL CHECK (selected_response IN ('a', 'b')),
  is_correct BOOLEAN NOT NULL,
  earnings_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  time_taken_seconds INTEGER NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, task_id)
);

-- Enable RLS
ALTER TABLE public.ai_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_tasks
CREATE POLICY "Anyone can view active AI tasks"
  ON public.ai_tasks
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage AI tasks"
  ON public.ai_tasks
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for task_completions
CREATE POLICY "Users can view their own completions"
  ON public.task_completions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own completions"
  ON public.task_completions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all completions"
  ON public.task_completions
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX idx_ai_tasks_category ON public.ai_tasks(category);
CREATE INDEX idx_ai_tasks_difficulty ON public.ai_tasks(difficulty);
CREATE INDEX idx_ai_tasks_is_active ON public.ai_tasks(is_active);
CREATE INDEX idx_ai_tasks_created_at ON public.ai_tasks(created_at);
CREATE INDEX idx_task_completions_user_id ON public.task_completions(user_id);
CREATE INDEX idx_task_completions_task_id ON public.task_completions(task_id);
CREATE INDEX idx_task_completions_completed_at ON public.task_completions(completed_at);