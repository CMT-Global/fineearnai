-- Add admin role for qafeocapital@gmail.com (user ID: a68bfa60-7831-4202-bdc6-1244d18a689c)
INSERT INTO public.user_roles (user_id, role)
VALUES ('a68bfa60-7831-4202-bdc6-1244d18a689c', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;