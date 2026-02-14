-- Prevent deletion of email templates: admins can only SELECT, INSERT, UPDATE (enable/disable).
-- No one can DELETE rows from email_templates (RLS + trigger for service-role safety).

-- 1. Drop existing policies so we can replace with SELECT/INSERT/UPDATE only (no DELETE). Idempotent.
DROP POLICY IF EXISTS "Admins can manage email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Admins can select email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Admins can insert email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Admins can update email templates" ON public.email_templates;

-- 2. Admins can read email templates
CREATE POLICY "Admins can select email templates"
  ON public.email_templates
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Admins can insert new email templates (e.g. custom)
CREATE POLICY "Admins can insert email templates"
  ON public.email_templates
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. Admins can update email templates (edit content, enable/disable)
CREATE POLICY "Admins can update email templates"
  ON public.email_templates
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5. No DELETE policy: RLS will deny DELETE for anon/authenticated.
-- 6. Trigger to block DELETE even for service_role (belt and suspenders)
CREATE OR REPLACE FUNCTION public.prevent_email_template_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Deleting email templates is not allowed. Use enable/disable (is_active) instead.'
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS prevent_email_template_delete_trigger ON public.email_templates;
CREATE TRIGGER prevent_email_template_delete_trigger
  BEFORE DELETE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_email_template_delete();

COMMENT ON FUNCTION public.prevent_email_template_delete() IS 'Prevents accidental deletion of email templates; admins should use is_active to disable.';
