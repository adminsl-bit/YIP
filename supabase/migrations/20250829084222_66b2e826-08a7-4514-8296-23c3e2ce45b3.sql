-- Insert default system settings if they don't exist
INSERT INTO public.system_settings (setting_key, setting_value, description, updated_by)
SELECT 
  'voting_enabled',
  'true',
  'Allow students to participate in polls and voting sessions',
  '00000000-0000-0000-0000-000000000000'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.system_settings WHERE setting_key = 'voting_enabled'
);

INSERT INTO public.system_settings (setting_key, setting_value, description, updated_by)
SELECT 
  'results_public',
  'false',
  'Display voting results and poll outcomes to all users',
  '00000000-0000-0000-0000-000000000000'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.system_settings WHERE setting_key = 'results_public'
);

INSERT INTO public.system_settings (setting_key, setting_value, description, updated_by)
SELECT 
  'assessments_locked',
  'false',
  'Prevent jury members from modifying their assessments',
  '00000000-0000-0000-0000-000000000000'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.system_settings WHERE setting_key = 'assessments_locked'
);

INSERT INTO public.system_settings (setting_key, setting_value, description, updated_by)
SELECT 
  'leaderboard_visible',
  'true',
  'Display performance rankings to students',
  '00000000-0000-0000-0000-000000000000'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.system_settings WHERE setting_key = 'leaderboard_visible'
);