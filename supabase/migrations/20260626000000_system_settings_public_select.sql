-- Allow everyone (including unauthenticated visitors on /register) to READ
-- system_settings. These are feature flags, not secrets — writing remains
-- restricted to organizers/super_admins. The prior "Only organizers can view
-- system settings" policy broke students, jury, and public pages that all
-- read settings like voting_enabled, leaderboard_visible, question_hour_visible,
-- and registration_enabled.
DROP POLICY IF EXISTS "Only organizers can view system settings" ON public.system_settings;

CREATE POLICY "Anyone can read system settings"
ON public.system_settings
FOR SELECT
USING (true);
