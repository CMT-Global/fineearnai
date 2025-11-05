-- Phase 2: Database Optimization for Password Reset
-- Add index on profiles.email for faster lookups (scalable to 1M+ users)

-- Create case-insensitive index on email for optimal performance
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower 
ON profiles (LOWER(email));

-- Add unique constraint on email to ensure data integrity
-- Use IF NOT EXISTS pattern to avoid errors if constraint already exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_profile_email'
  ) THEN
    ALTER TABLE profiles 
    ADD CONSTRAINT unique_profile_email 
    UNIQUE (email);
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON INDEX idx_profiles_email_lower IS 'Case-insensitive index for password reset email lookups - optimized for 1M+ users';