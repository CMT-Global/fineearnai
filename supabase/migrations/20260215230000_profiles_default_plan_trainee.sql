-- Default plan is Trainee (no longer 'free').
ALTER TABLE public.profiles
  ALTER COLUMN membership_plan SET DEFAULT 'Trainee';
