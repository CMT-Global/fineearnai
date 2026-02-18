-- Add task_4opt_access_config to platform_config
-- plans_4opt: membership plan names (users on these plans see 4-option tasks)
-- roles_4opt: role names that grant 4-option access (e.g. trainee_4opt for manual override via Manage Roles)
INSERT INTO public.platform_config (key, value, description)
VALUES (
  'task_4opt_access_config',
  '{"plans_4opt": [], "roles_4opt": ["trainee_4opt"]}'::jsonb,
  '4-option AI task access: plans_4opt = membership plan names; roles_4opt = role names that grant 4-option'
)
ON CONFLICT (key) DO NOTHING;
