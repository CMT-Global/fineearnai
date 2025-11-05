-- Phase 1: Add Database Column for Toggle State Persistence
-- This column tracks whether a template was saved with the wrapper baked in (true) 
-- or as plain content that will be auto-wrapped at send time (false)

ALTER TABLE email_templates 
ADD COLUMN use_wrapper_in_editor BOOLEAN DEFAULT false;

COMMENT ON COLUMN email_templates.use_wrapper_in_editor IS 
'UI-only flag: indicates if template was saved with wrapper baked in (true) or as plain content (false). Does not affect sending - edge functions auto-wrap regardless.';