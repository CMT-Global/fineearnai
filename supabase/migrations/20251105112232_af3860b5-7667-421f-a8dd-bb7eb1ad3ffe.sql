-- Phase 5.c: Add email verification reminder configuration to platform_config

-- Insert email verification reminder configuration
INSERT INTO public.platform_config (key, value, description, created_at, updated_at)
VALUES (
  'email_verification_reminders',
  jsonb_build_object(
    'enabled', true,
    'first_reminder_days', 3,
    'second_reminder_days', 7,
    'third_reminder_days', 14,
    'reminder_frequency_days', 7,
    'max_reminders', 5
  ),
  'Configuration for automated email verification reminder system. Controls when and how often reminders are sent to unverified users.',
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE
SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Create email verification reminder tracking table
CREATE TABLE IF NOT EXISTS public.email_verification_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_count INTEGER NOT NULL DEFAULT 0,
  last_reminder_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_email_verification_reminders_user_id 
ON public.email_verification_reminders(user_id);

CREATE INDEX IF NOT EXISTS idx_email_verification_reminders_last_sent 
ON public.email_verification_reminders(last_reminder_sent_at);

-- Enable RLS
ALTER TABLE public.email_verification_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own reminder records"
ON public.email_verification_reminders
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all reminder records"
ON public.email_verification_reminders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Service role can manage reminders"
ON public.email_verification_reminders
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add trigger to update updated_at
CREATE TRIGGER update_email_verification_reminders_updated_at
BEFORE UPDATE ON public.email_verification_reminders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.email_verification_reminders IS 'Tracks email verification reminder history for each user to prevent spam and manage reminder frequency';
COMMENT ON COLUMN public.email_verification_reminders.reminder_count IS 'Total number of reminders sent to this user';
COMMENT ON COLUMN public.email_verification_reminders.last_reminder_sent_at IS 'Timestamp of the most recent reminder sent';