-- Create cpay_checkouts table to store pre-configured CPAY checkout pages
CREATE TABLE public.cpay_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_id TEXT UNIQUE NOT NULL,
  checkout_url TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USDT',
  min_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  max_amount NUMERIC(10, 2) NOT NULL DEFAULT 10000.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cpay_checkouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage CPAY checkouts"
  ON public.cpay_checkouts
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active CPAY checkouts"
  ON public.cpay_checkouts
  FOR SELECT
  USING (is_active = true);

-- Create updated_at trigger
CREATE TRIGGER update_cpay_checkouts_updated_at
  BEFORE UPDATE ON public.cpay_checkouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_cpay_checkouts_active ON public.cpay_checkouts(is_active) WHERE is_active = true;
CREATE INDEX idx_cpay_checkouts_currency ON public.cpay_checkouts(currency, is_active);

COMMENT ON TABLE public.cpay_checkouts IS 'Stores pre-configured CPAY checkout pages for deposits';
COMMENT ON COLUMN public.cpay_checkouts.checkout_id IS 'Unique checkout ID from CPAY dashboard (e.g., a55901c9-7cab-44a5-adf9-5a1562056256)';
COMMENT ON COLUMN public.cpay_checkouts.checkout_url IS 'Full checkout URL with custom domain (e.g., https://checkouts.fineearn.com/checkout/{checkout_id})';