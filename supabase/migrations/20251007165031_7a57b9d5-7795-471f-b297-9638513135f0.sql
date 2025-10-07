-- Create task status enum
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'skipped', 'expired');

-- Create task difficulty enum
CREATE TYPE public.task_difficulty AS ENUM ('easy', 'medium', 'hard');

-- Create tasks table
CREATE TABLE public.tasks (
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

-- Create user_tasks table (tracks individual user task assignments)
CREATE TABLE public.user_tasks (
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

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks
CREATE POLICY "Anyone can view active tasks"
  ON public.tasks FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage tasks"
  ON public.tasks FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for user_tasks
CREATE POLICY "Users can view their own tasks"
  ON public.user_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
  ON public.user_tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all user tasks"
  ON public.user_tasks FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage user tasks"
  ON public.user_tasks FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX idx_user_tasks_user_id ON public.user_tasks(user_id);
CREATE INDEX idx_user_tasks_status ON public.user_tasks(status);
CREATE INDEX idx_user_tasks_assigned_at ON public.user_tasks(assigned_at DESC);
CREATE INDEX idx_tasks_active ON public.tasks(is_active);

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

-- Trigger for tasks updated_at
CREATE TRIGGER update_tasks_timestamp
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tasks_updated_at();

-- Insert sample tasks
INSERT INTO public.tasks (title, description, difficulty, base_reward, time_estimate_minutes, instructions) VALUES
('Image Classification', 'Classify images into correct categories to help train AI vision models', 'easy', 5.00, 30, 
  '[{"step": 1, "text": "Review the image carefully"}, {"step": 2, "text": "Select the most appropriate category"}, {"step": 3, "text": "Confirm your selection"}]'::jsonb),
('Text Sentiment Analysis', 'Analyze text content and identify the emotional tone and sentiment', 'medium', 7.50, 35,
  '[{"step": 1, "text": "Read the text thoroughly"}, {"step": 2, "text": "Identify emotional indicators"}, {"step": 3, "text": "Rate sentiment on provided scale"}]'::jsonb),
('Audio Transcription Review', 'Review and correct AI-generated audio transcriptions for accuracy', 'medium', 8.00, 40,
  '[{"step": 1, "text": "Listen to audio clip"}, {"step": 2, "text": "Review transcription"}, {"step": 3, "text": "Make necessary corrections"}]'::jsonb),
('Data Validation', 'Verify accuracy of data entries and flag any inconsistencies or errors', 'easy', 4.50, 25,
  '[{"step": 1, "text": "Review data entries"}, {"step": 2, "text": "Check for inconsistencies"}, {"step": 3, "text": "Flag errors found"}]'::jsonb),
('Content Moderation', 'Review user-generated content and ensure it meets community guidelines', 'hard', 10.00, 45,
  '[{"step": 1, "text": "Review content item"}, {"step": 2, "text": "Check against guidelines"}, {"step": 3, "text": "Make moderation decision"}]'::jsonb);