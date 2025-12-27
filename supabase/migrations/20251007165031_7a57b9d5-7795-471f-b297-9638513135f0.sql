-- Create task status enum (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'skipped', 'expired');
  END IF;
END $$;

-- Create task difficulty enum (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_difficulty') THEN
    CREATE TYPE public.task_difficulty AS ENUM ('easy', 'medium', 'hard');
  END IF;
END $$;

-- Create tasks table (idempotent)
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  difficulty public.task_difficulty NOT NULL DEFAULT 'easy',
  base_reward NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  time_estimate_minutes INTEGER NOT NULL DEFAULT 30,
  instructions JSONB DEFAULT '[]'::jsonb,
  validation_criteria JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_tasks table (tracks individual user task assignments) (idempotent)
CREATE TABLE IF NOT EXISTS public.user_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  status public.task_status NOT NULL DEFAULT 'pending',
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  skipped_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  submission_data JSONB DEFAULT '{}'::jsonb,
  earned_amount NUMERIC(10, 2) DEFAULT 0.00,
  UNIQUE(user_id, task_id, assigned_at)
);

-- Enable RLS (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'tasks' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'user_tasks' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- RLS Policies for tasks (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'tasks' 
    AND policyname = 'Anyone can view active tasks'
  ) THEN
    CREATE POLICY "Anyone can view active tasks"
      ON public.tasks FOR SELECT
      USING (is_active = true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'tasks' 
    AND policyname = 'Admins can manage tasks'
  ) THEN
    CREATE POLICY "Admins can manage tasks"
      ON public.tasks FOR ALL
      USING (has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- RLS Policies for user_tasks (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_tasks' 
    AND policyname = 'Users can view their own tasks'
  ) THEN
    CREATE POLICY "Users can view their own tasks"
      ON public.user_tasks FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_tasks' 
    AND policyname = 'Users can update their own tasks'
  ) THEN
    CREATE POLICY "Users can update their own tasks"
      ON public.user_tasks FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_tasks' 
    AND policyname = 'Admins can view all user tasks'
  ) THEN
    CREATE POLICY "Admins can view all user tasks"
      ON public.user_tasks FOR SELECT
      USING (has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_tasks' 
    AND policyname = 'Admins can manage user tasks'
  ) THEN
    CREATE POLICY "Admins can manage user tasks"
      ON public.user_tasks FOR ALL
      USING (has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Create indexes for performance (idempotent)
CREATE INDEX IF NOT EXISTS idx_user_tasks_user_id ON public.user_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_status ON public.user_tasks(status);
CREATE INDEX IF NOT EXISTS idx_user_tasks_assigned_at ON public.user_tasks(assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_active ON public.tasks(is_active);

-- Function to update tasks updated_at
CREATE OR REPLACE FUNCTION public.update_tasks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger for tasks updated_at (idempotent)
DROP TRIGGER IF EXISTS update_tasks_timestamp ON public.tasks;
CREATE TRIGGER update_tasks_timestamp
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tasks_updated_at();

-- Insert sample tasks (idempotent - skip if they already exist)
DO $$
BEGIN
  -- Insert each task only if it doesn't already exist
  IF NOT EXISTS (SELECT 1 FROM public.tasks WHERE title = 'Image Classification') THEN
    INSERT INTO public.tasks (title, description, difficulty, base_reward, time_estimate_minutes, instructions) VALUES
    ('Image Classification', 'Classify images into correct categories to help train AI vision models', 'easy'::task_difficulty, 5.00, 30, 
      '[{"step": 1, "text": "Review the image carefully"}, {"step": 2, "text": "Select the most appropriate category"}, {"step": 3, "text": "Confirm your selection"}]'::jsonb);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tasks WHERE title = 'Text Sentiment Analysis') THEN
    INSERT INTO public.tasks (title, description, difficulty, base_reward, time_estimate_minutes, instructions) VALUES
    ('Text Sentiment Analysis', 'Analyze text content and identify the emotional tone and sentiment', 'medium'::task_difficulty, 7.50, 35,
      '[{"step": 1, "text": "Read the text thoroughly"}, {"step": 2, "text": "Identify emotional indicators"}, {"step": 3, "text": "Rate sentiment on provided scale"}]'::jsonb);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tasks WHERE title = 'Audio Transcription Review') THEN
    INSERT INTO public.tasks (title, description, difficulty, base_reward, time_estimate_minutes, instructions) VALUES
    ('Audio Transcription Review', 'Review and correct AI-generated audio transcriptions for accuracy', 'medium'::task_difficulty, 8.00, 40,
      '[{"step": 1, "text": "Listen to audio clip"}, {"step": 2, "text": "Review transcription"}, {"step": 3, "text": "Make necessary corrections"}]'::jsonb);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tasks WHERE title = 'Data Validation') THEN
    INSERT INTO public.tasks (title, description, difficulty, base_reward, time_estimate_minutes, instructions) VALUES
    ('Data Validation', 'Verify accuracy of data entries and flag any inconsistencies or errors', 'easy'::task_difficulty, 4.50, 25,
      '[{"step": 1, "text": "Review data entries"}, {"step": 2, "text": "Check for inconsistencies"}, {"step": 3, "text": "Flag errors found"}]'::jsonb);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tasks WHERE title = 'Content Moderation') THEN
    INSERT INTO public.tasks (title, description, difficulty, base_reward, time_estimate_minutes, instructions) VALUES
    ('Content Moderation', 'Review user-generated content and ensure it meets community guidelines', 'hard'::task_difficulty, 10.00, 45,
      '[{"step": 1, "text": "Review content item"}, {"step": 2, "text": "Check against guidelines"}, {"step": 3, "text": "Make moderation decision"}]'::jsonb);
  END IF;
END $$;