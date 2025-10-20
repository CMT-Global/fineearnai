-- Add preferred_currency column to profiles table for currency conversion feature
ALTER TABLE public.profiles 
ADD COLUMN preferred_currency TEXT NOT NULL DEFAULT 'USD';

-- Add index for faster queries when filtering by currency
CREATE INDEX idx_profiles_preferred_currency ON public.profiles(preferred_currency);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.preferred_currency IS 'User preferred display currency (ISO 4217 3-letter code). Base currency for all transactions is USD.';