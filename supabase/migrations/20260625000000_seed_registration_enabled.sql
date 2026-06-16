-- Seed the registration_enabled system setting
--
-- The "Public Registration" toggle in Organizer Controls
-- (FeatureToggles.tsx) writes to system_settings.registration_enabled, but
-- no row for this key was ever seeded. As a result, toggling it off had no
-- effect — Register.tsx's getSystemSetting() hardcoded a `true` fallback
-- whenever the row was missing, so registration always appeared open.
--
-- Default to 'true' to preserve current (open) behaviour; organizers can now
-- flip this off from Controls once bulk import is complete.

INSERT INTO public.system_settings (setting_key, setting_value, description, updated_by)
SELECT
  'registration_enabled',
  'true'::jsonb,
  'Allow new students to register themselves via the landing page',
  '00000000-0000-0000-0000-000000000000'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.system_settings WHERE setting_key = 'registration_enabled'
);
