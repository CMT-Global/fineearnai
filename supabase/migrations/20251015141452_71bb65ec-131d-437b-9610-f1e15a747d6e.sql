-- Create payment processors table for configuring payment methods
CREATE TABLE public.payment_processors (
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

-- Enable RLS
ALTER TABLE public.payment_processors ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage payment processors"
ON public.payment_processors
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active payment processors"
ON public.payment_processors
FOR SELECT
USING (is_active = true);

-- Create index for performance
CREATE INDEX idx_payment_processors_active ON public.payment_processors(is_active);
CREATE INDEX idx_payment_processors_type ON public.payment_processors(processor_type);