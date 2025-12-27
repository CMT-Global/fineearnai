-- Create partner onboarding tracking table
CREATE TABLE IF NOT EXISTS public.partner_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  setup_completed BOOLEAN NOT NULL DEFAULT false,
  steps_completed JSONB NOT NULL DEFAULT '{
    "profile_completed": false,
    "payment_methods_set": false,
    "first_voucher_created": false,
    "community_joined": false,
    "guidelines_read": false
  }'::jsonb,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(partner_id)
);

-- Enable RLS
ALTER TABLE public.partner_onboarding ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Partners can view their own onboarding" ON public.partner_onboarding;
CREATE POLICY "Partners can view their own onboarding"
  ON public.partner_onboarding
  FOR SELECT
  USING (auth.uid() = partner_id);

DROP POLICY IF EXISTS "Partners can update their own onboarding" ON public.partner_onboarding;
CREATE POLICY "Partners can update their own onboarding"
  ON public.partner_onboarding
  FOR UPDATE
  USING (auth.uid() = partner_id)
  WITH CHECK (auth.uid() = partner_id);

DROP POLICY IF EXISTS "System can insert onboarding records" ON public.partner_onboarding;
CREATE POLICY "System can insert onboarding records"
  ON public.partner_onboarding
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view all onboarding records" ON public.partner_onboarding;
CREATE POLICY "Admins can view all onboarding records"
  ON public.partner_onboarding
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_partner_onboarding_partner_id ON public.partner_onboarding(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_onboarding_setup_completed ON public.partner_onboarding(setup_completed);

-- Create trigger to automatically create onboarding record when partner role is assigned
CREATE OR REPLACE FUNCTION create_partner_onboarding()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'partner'::app_role THEN
    INSERT INTO public.partner_onboarding (partner_id)
    VALUES (NEW.user_id)
    ON CONFLICT (partner_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_partner_role_assigned ON public.user_roles;
CREATE TRIGGER on_partner_role_assigned
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION create_partner_onboarding();

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_partner_onboarding_updated_at ON public.partner_onboarding;
CREATE TRIGGER update_partner_onboarding_updated_at
  BEFORE UPDATE ON public.partner_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();