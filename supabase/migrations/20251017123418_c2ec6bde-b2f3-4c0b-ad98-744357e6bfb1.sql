-- Phase 1: Add Task Uniqueness Constraint
-- Add prompt_hash column and unique constraint to prevent duplicate AI tasks

-- Add prompt_hash column (computed from prompt using MD5)
ALTER TABLE public.ai_tasks 
ADD COLUMN IF NOT EXISTS prompt_hash TEXT GENERATED ALWAYS AS (md5(prompt)) STORED;

-- Create unique index on prompt_hash to prevent duplicate prompts
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_tasks_prompt_hash_unique 
ON public.ai_tasks(prompt_hash);

-- Add comment for documentation
COMMENT ON COLUMN public.ai_tasks.prompt_hash IS 'MD5 hash of prompt text used to enforce uniqueness and prevent duplicate task generation';

-- Create index on prompt_hash for faster lookups during task generation
CREATE INDEX IF NOT EXISTS idx_ai_tasks_prompt_hash_lookup 
ON public.ai_tasks(prompt_hash) 
WHERE is_active = true;