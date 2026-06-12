-- The Super Admin Roles dashboard reads public.user_roles to classify each
-- student profile as Admin Student / Journalist / Regular Student. RLS on
-- user_roles only allowed organizers (and the row's own user) to read it, so
-- for super admins every lookup came back empty and admin students/
-- journalists were silently miscounted as regular students.
CREATE POLICY "Super admins can view all roles"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.user_type = 'super_admin'
  )
);
