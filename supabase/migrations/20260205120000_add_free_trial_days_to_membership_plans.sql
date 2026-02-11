-- Add free_trial_days to membership_plans for onboarding "Start Free Trial" per plan.
-- Admin can set 0 to disable trial for a plan; when > 0, step 9 shows "Free Trial: X days" and step 10 allows starting trial for that plan.
ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS free_trial_days INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.membership_plans.free_trial_days IS 'Number of days for free trial when user selects this plan in onboarding (step 10). 0 = no trial; hide trial option.';

-- Reload PostgREST schema cache so API/Edge Functions see the new column
NOTIFY pgrst, 'reload schema';
