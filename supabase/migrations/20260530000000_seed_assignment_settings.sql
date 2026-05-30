-- Seed default assignment_committees if not present
INSERT INTO public.system_settings (setting_key, setting_value, description, updated_by)
SELECT
  'assignment_committees',
  '["IT & Education","Women and Child Safety","Health & Sports","Environment & Road Transport","Tourism and Culture"]'::jsonb,
  'Ordered list of committee names assigned round-robin during student onboarding',
  '00000000-0000-0000-0000-000000000000'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.system_settings WHERE setting_key = 'assignment_committees'
);

-- Seed default assignment_parties if not present
INSERT INTO public.system_settings (setting_key, setting_value, description, updated_by)
SELECT
  'assignment_parties',
  '["Party A","Party B","Party C","Party D","Party E"]'::jsonb,
  'Ordered list of party names assigned round-robin during student onboarding',
  '00000000-0000-0000-0000-000000000000'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.system_settings WHERE setting_key = 'assignment_parties'
);
