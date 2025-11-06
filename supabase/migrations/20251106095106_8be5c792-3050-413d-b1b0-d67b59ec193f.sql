-- ============================================================================
-- Phase 1: Add Foreign Key Constraint and Index
-- Links partner_applications.user_id to profiles.id
-- ============================================================================

-- Add foreign key constraint from partner_applications.user_id to profiles.id
-- CASCADE ensures orphaned applications are cleaned up if user profile is deleted
ALTER TABLE partner_applications
ADD CONSTRAINT fk_partner_applications_user_id 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Add index on user_id for improved query performance
CREATE INDEX IF NOT EXISTS idx_partner_applications_user_id 
ON partner_applications(user_id);

-- Add helpful comments for documentation
COMMENT ON CONSTRAINT fk_partner_applications_user_id ON partner_applications 
IS 'Links partner applications to user profiles. Cascade delete ensures orphaned applications are cleaned up when a user profile is deleted.';

COMMENT ON INDEX idx_partner_applications_user_id 
IS 'Improves query performance when joining partner_applications with profiles table.';