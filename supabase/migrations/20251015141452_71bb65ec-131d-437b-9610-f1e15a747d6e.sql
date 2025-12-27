-- Create payment processors table for configuring payment methods (idempotent)
CREATE TABLE IF NOT EXISTS public.payment_processors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  processor_type TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  fee_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  fee_fixed NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  min_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  max_amount NUMERIC(10, 2) NOT NULL DEFAULT 10000.00,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(name, processor_type)
);

-- Enable RLS (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'payment_processors' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.payment_processors ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create policies (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'payment_processors' 
    AND policyname = 'Admins can manage payment processors'
  ) THEN
    CREATE POLICY "Admins can manage payment processors"
    ON public.payment_processors
    FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'payment_processors' 
    AND policyname = 'Anyone can view active payment processors'
  ) THEN
    CREATE POLICY "Anyone can view active payment processors"
    ON public.payment_processors
    FOR SELECT
    USING (is_active = true);
  END IF;
END $$;

-- Create index for performance (idempotent)
CREATE INDEX IF NOT EXISTS idx_payment_processors_active ON public.payment_processors(is_active);
CREATE INDEX IF NOT EXISTS idx_payment_processors_type ON public.payment_processors(processor_type);