-- Phase 1: Add Database Column for Toggle State Persistence
-- This column tracks whether a template was saved with the wrapper baked in (true) 
-- or as plain content that will be auto-wrapped at send time (false)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'email_templates' 
      AND column_name = 'use_wrapper_in_editor'
  ) THEN
    ALTER TABLE email_templates 
    ADD COLUMN use_wrapper_in_editor BOOLEAN DEFAULT false;
  END IF;
END $$;

COMMENT ON COLUMN email_templates.use_wrapper_in_editor IS 
'UI-only flag: indicates if template was saved with wrapper baked in (true) or as plain content (false). Does not affect sending - edge functions auto-wrap regardless.';