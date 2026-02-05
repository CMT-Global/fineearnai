-- Create referral_clicks table for tracking creator link clicks
-- This enables attribution and analytics for Content Rewards program

CREATE TABLE IF NOT EXISTS public.referral_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  utm_source TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  ip_address TEXT,
  user_agent TEXT,
  converted_to_signup BOOLEAN NOT NULL DEFAULT false,
  converted_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_referral_clicks_referrer_id 
ON public.referral_clicks(referrer_id);

CREATE INDEX IF NOT EXISTS idx_referral_clicks_clicked_at 
ON public.referral_clicks(clicked_at);

CREATE INDEX IF NOT EXISTS idx_referral_clicks_converted 
ON public.referral_clicks(converted_to_signup) 
WHERE converted_to_signup = true;

CREATE INDEX IF NOT EXISTS idx_referral_clicks_utm_source 
ON public.referral_clicks(utm_source) 
WHERE utm_source IS NOT NULL;

-- Enable RLS
ALTER TABLE public.referral_clicks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own referral clicks
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'referral_clicks' 
    AND policyname = 'Users can view their own referral clicks'
  ) THEN
    CREATE POLICY "Users can view their own referral clicks"
    ON public.referral_clicks
    FOR SELECT
    USING (auth.uid() = referrer_id);
  END IF;
END $$;

-- Policy: Admins can view all referral clicks
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'referral_clicks' 
    AND policyname = 'Admins can view all referral clicks'
  ) THEN
    CREATE POLICY "Admins can view all referral clicks"
    ON public.referral_clicks
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
      )
    );
  END IF;
END $$;
