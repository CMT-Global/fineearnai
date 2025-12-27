-- Phase 1: Create notifications table for admin alerts

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
  ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read 
  ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
  ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_priority 
  ON public.notifications(priority);

-- Enable RLS (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'notifications' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- RLS policies (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'notifications' 
    AND policyname = 'Users can view their own notifications'
  ) THEN
    CREATE POLICY "Users can view their own notifications"
      ON public.notifications
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'notifications' 
    AND policyname = 'Users can update their own notifications'
  ) THEN
    CREATE POLICY "Users can update their own notifications"
      ON public.notifications
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'notifications' 
    AND policyname = 'Admins can view all notifications'
  ) THEN
    CREATE POLICY "Admins can view all notifications"
      ON public.notifications
      FOR SELECT
      USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'notifications' 
    AND policyname = 'Service role can insert notifications'
  ) THEN
    CREATE POLICY "Service role can insert notifications"
      ON public.notifications
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.notifications IS 'User notifications including system alerts and admin notifications';