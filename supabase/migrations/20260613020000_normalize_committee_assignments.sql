-- Force the assignment_committees setting back to the canonical 5-committee list.
-- The earlier seed (20260530000000) only inserted this row if it didn't already
-- exist, so a pre-existing row with stale/extra entries (e.g. "Committee 8",
-- "Committee 9") would have survived and kept feeding the onboarding round-robin.
UPDATE public.system_settings
SET setting_value = '["IT & Education","Women and Child Safety","Health & Sports","Environment & Road Transport","Tourism and Culture"]'::jsonb,
    updated_at = now()
WHERE setting_key = 'assignment_committees';

INSERT INTO public.system_settings (setting_key, setting_value, description, updated_by)
SELECT
  'assignment_committees',
  '["IT & Education","Women and Child Safety","Health & Sports","Environment & Road Transport","Tourism and Culture"]'::jsonb,
  'Ordered list of committee names assigned round-robin during student onboarding',
  '00000000-0000-0000-0000-000000000000'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.system_settings WHERE setting_key = 'assignment_committees'
);

-- Reassign any student whose profiles.committee value is not one of the 5
-- canonical committees (e.g. stray "Committee 8" / "Committee 9" values from
-- bulk imports or the stale assignment list above) to one of the 5, round-robin
-- by serial number so the redistribution stays roughly even.
WITH canonical(committee_name, idx) AS (
  VALUES
    ('IT & Education', 0),
    ('Women and Child Safety', 1),
    ('Health & Sports', 2),
    ('Environment & Road Transport', 3),
    ('Tourism and Culture', 4)
),
stray AS (
  SELECT user_id,
         row_number() OVER (ORDER BY serial_number, user_id) - 1 AS rn
  FROM public.profiles
  WHERE user_type = 'student'
    AND committee IS NOT NULL
    AND committee NOT IN (
      'IT & Education',
      'Women and Child Safety',
      'Health & Sports',
      'Environment & Road Transport',
      'Tourism and Culture'
    )
)
UPDATE public.profiles p
SET committee = c.committee_name
FROM stray s
JOIN canonical c ON c.idx = (s.rn % 5)
WHERE p.user_id = s.user_id;
