-- Add preferred_language column to profiles table for language detection feature
-- This allows users to save their language preference, which can be auto-detected from IP or manually set

-- Check if column exists before adding (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'preferred_language'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN preferred_language TEXT DEFAULT NULL;
    END IF;
END $$;

-- Add index for faster queries when filtering by language (idempotent)
CREATE INDEX IF NOT EXISTS idx_profiles_preferred_language ON public.profiles(preferred_language);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.preferred_language IS 'User preferred display language (ISO 639-1 code: en, es, fr, de, it). NULL means use auto-detection from IP address.';
