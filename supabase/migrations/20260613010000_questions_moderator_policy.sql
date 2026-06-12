-- Question Hour: lets Organizers, Super Admins and Admin Students mark any
-- question "Completed" (status/is_discussing) once the minister has spoken
-- on it, regardless of which ministry it was addressed to. Mirrors the
-- isStaffRole / hasRole('admin_student') checks already used client-side.
CREATE POLICY "Moderators can update any question"
ON public.questions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.user_type IN ('organizer', 'super_admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin_student'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.user_type IN ('organizer', 'super_admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin_student'
  )
);
