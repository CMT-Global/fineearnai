-- Add task_manager_4opt and trainee_4opt to app_role enum.
-- Must run in a separate migration: PostgreSQL requires new enum values to be committed
-- before they can be used (e.g. in RLS policies).
-- - task_manager_4opt: admin role for managing 4-option tasks
-- - trainee_4opt: user role - when assigned, user sees 4-option tasks instead of 2-option
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'task_manager_4opt';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'trainee_4opt';
