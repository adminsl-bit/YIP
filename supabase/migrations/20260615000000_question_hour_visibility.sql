-- Question Hour visibility toggle
--
-- Lets organizers (and admin-students / super-admins) hide the Question
-- Hour from students entirely — e.g. before the session opens — via a
-- system_settings flag.

INSERT INTO public.system_settings (setting_key, setting_value, description, updated_by)
SELECT
  'question_hour_visible',
  'true'::jsonb,
  'Controls whether students can view and participate in Question Hour',
  '00000000-0000-0000-0000-000000000000'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.system_settings WHERE setting_key = 'question_hour_visible'
);

-- Broaden settings management to super-admins and admin-students, not just organizers
DROP POLICY IF EXISTS "Only organizers can manage settings" ON public.system_settings;
CREATE POLICY "Only organizers can manage settings"
ON public.system_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND user_type IN ('organizer', 'super_admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin_student'
  )
);
