-- Phase 1: Critical Infrastructure - Cron Jobs Setup

-- 1. Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Daily Reset Cron Job (runs at midnight UTC daily)
-- This resets tasks_completed_today and skips_today for all users
SELECT cron.schedule(
  'daily-reset-user-counters',
  '0 0 * * *', -- Every day at midnight UTC
  $$
  SELECT
    net.http_post(
      url:='https://mobikymhzchzakwzpqep.supabase.co/functions/v1/reset-daily-counters',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vYmlreW1oemNoemFrd3pwcWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NTIzODcsImV4cCI6MjA3NTQyODM4N30.XWSL-ZIzX2DRp5lO7lYnj7L3Cns2z2g3OGdtb8JhDRc"}'::jsonb,
      body:=concat('{"timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- 3. Commission Queue Processor Cron Job (runs every 5 minutes)
-- This processes pending referral commissions in batches
SELECT cron.schedule(
  'process-commission-queue',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url:='https://mobikymhzchzakwzpqep.supabase.co/functions/v1/process-commission-queue',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vYmlreW1oemNoemFrd3pwcWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NTIzODcsImV4cCI6MjA3NTQyODM4N30.XWSL-ZIzX2DRp5lO7lYnj7L3Cns2z2g3OGdtb8JhDRc"}'::jsonb,
      body:=concat('{"timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- 4. Create table for task pool monitoring metrics
CREATE TABLE IF NOT EXISTS public.task_pool_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  active_task_count INTEGER NOT NULL,
  total_task_count INTEGER NOT NULL,
  tasks_completed_last_24h INTEGER NOT NULL,
  average_completion_rate NUMERIC(10, 2),
  alert_triggered BOOLEAN DEFAULT false,
  alert_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on task_pool_metrics
ALTER TABLE public.task_pool_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_pool_metrics
CREATE POLICY "Admins can view task pool metrics"
  ON public.task_pool_metrics
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert metrics"
  ON public.task_pool_metrics
  FOR INSERT
  WITH CHECK (true);

-- 5. Create function to get task pool health
CREATE OR REPLACE FUNCTION public.get_task_pool_health()
RETURNS TABLE (
  active_tasks INTEGER,
  total_tasks INTEGER,
  completed_last_24h INTEGER,
  avg_completion_rate NUMERIC,
  health_status TEXT,
  recommendation TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_tasks INTEGER;
  v_total_tasks INTEGER;
  v_completed_24h INTEGER;
  v_avg_rate NUMERIC;
  v_health TEXT;
  v_recommendation TEXT;
BEGIN
  -- Get active task count
  SELECT COUNT(*) INTO v_active_tasks
  FROM ai_tasks
  WHERE is_active = true;
  
  -- Get total task count
  SELECT COUNT(*) INTO v_total_tasks
  FROM ai_tasks;
  
  -- Get completions in last 24 hours
  SELECT COUNT(*) INTO v_completed_24h
  FROM task_completions
  WHERE completed_at >= now() - interval '24 hours';
  
  -- Calculate average completion rate (tasks per hour)
  v_avg_rate := v_completed_24h / 24.0;
  
  -- Determine health status
  IF v_active_tasks < 100 THEN
    v_health := 'critical';
    v_recommendation := 'URGENT: Generate tasks immediately. Less than 100 active tasks available.';
  ELSIF v_active_tasks < 500 THEN
    v_health := 'warning';
    v_recommendation := 'WARNING: Task pool is low. Generate more tasks soon.';
  ELSIF v_active_tasks < 1000 THEN
    v_health := 'caution';
    v_recommendation := 'Task pool is adequate but should be replenished soon.';
  ELSE
    v_health := 'healthy';
    v_recommendation := 'Task pool is healthy.';
  END IF;
  
  RETURN QUERY SELECT 
    v_active_tasks,
    v_total_tasks,
    v_completed_24h,
    v_avg_rate,
    v_health,
    v_recommendation;
END;
$$;

-- 6. Create cron job for task pool monitoring (runs every 30 minutes)
SELECT cron.schedule(
  'monitor-task-pool',
  '*/30 * * * *', -- Every 30 minutes
  $$
  SELECT
    net.http_post(
      url:='https://mobikymhzchzakwzpqep.supabase.co/functions/v1/monitor-task-pool',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vYmlreW1oemNoemFrd3pwcWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NTIzODcsImV4cCI6MjA3NTQyODM4N30.XWSL-ZIzX2DRp5lO7lYnj7L3Cns2z2g3OGdtb8JhDRc"}'::jsonb,
      body:=concat('{"timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- 7. Create table for performance metrics tracking
CREATE TABLE IF NOT EXISTS public.edge_function_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  execution_time_ms INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_edge_function_metrics_function_name 
  ON public.edge_function_metrics(function_name);
CREATE INDEX IF NOT EXISTS idx_edge_function_metrics_created_at 
  ON public.edge_function_metrics(created_at DESC);

-- Enable RLS
ALTER TABLE public.edge_function_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can view all metrics"
  ON public.edge_function_metrics
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert metrics"
  ON public.edge_function_metrics
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE public.task_pool_metrics IS 'Tracks task availability and health metrics';
COMMENT ON TABLE public.edge_function_metrics IS 'Tracks edge function performance and errors';