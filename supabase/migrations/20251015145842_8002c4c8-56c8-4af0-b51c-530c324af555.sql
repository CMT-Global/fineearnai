-- Add admin role for qafeocapital@gmail.com (user ID: a68bfa60-7831-4202-bdc6-1244d18a689c)
-- Only insert if the user exists in auth.users
INSERT INTO public.user_roles (user_id, role)
SELECT 'c9614630-145c-4119-bcba-0298420d1eb4', 'admin'
WHERE EXISTS (
  SELECT 1 FROM auth.users WHERE id = 'c9614630-145c-4119-bcba-0298420d1eb4'
)
ON CONFLICT (user_id, role) DO NOTHING;