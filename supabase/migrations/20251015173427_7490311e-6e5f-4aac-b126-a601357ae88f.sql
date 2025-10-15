-- Phase 3: Database Query Optimizations
-- Add additional indexes for optimal query performance

-- Create composite index for transaction queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_created 
ON public.transactions(user_id, type, created_at DESC);

-- Create index for withdrawal requests by status and date
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status_created 
ON public.withdrawal_requests(status, created_at DESC) 
WHERE status IN ('pending', 'processing');

-- Create index for withdrawal requests by user
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_status 
ON public.withdrawal_requests(user_id, status, created_at DESC);

-- Create index for task completions by user and date
CREATE INDEX IF NOT EXISTS idx_task_completions_user_created 
ON public.task_completions(user_id, completed_at DESC);

-- Create index for task completions by task
CREATE INDEX IF NOT EXISTS idx_task_completions_task_created 
ON public.task_completions(task_id, completed_at DESC);

-- Create index for user_tasks by user and status
CREATE INDEX IF NOT EXISTS idx_user_tasks_user_status 
ON public.user_tasks(user_id, status, assigned_at DESC);

-- Create index for email logs by recipient and status
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_status 
ON public.email_logs(recipient_user_id, status, created_at DESC) 
WHERE recipient_user_id IS NOT NULL;

-- Analyze tables to update statistics for query planner
ANALYZE public.profiles;
ANALYZE public.referrals;
ANALYZE public.referral_earnings;
ANALYZE public.commission_queue;
ANALYZE public.transactions;
ANALYZE public.withdrawal_requests;
ANALYZE public.task_completions;
ANALYZE public.user_tasks;
ANALYZE public.email_logs;