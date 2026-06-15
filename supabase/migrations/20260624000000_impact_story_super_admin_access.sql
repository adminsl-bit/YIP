-- Impact Story: super admin read access for aggregate reporting
--
-- The Impact Story page (super admin only) reports network-wide totals for
-- polls run, votes cast, speeches recorded, award winners by segment, and
-- jury assessment rigor. These tables did not previously grant super admins
-- SELECT access. Add additive SELECT policies (OR'd with existing policies)
-- so is_super_admin() can read every row for these counts.

DROP POLICY IF EXISTS "Super admins can view all polls" ON public.polls;
CREATE POLICY "Super admins can view all polls"
  ON public.polls FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can view all poll votes" ON public.poll_votes;
CREATE POLICY "Super admins can view all poll votes"
  ON public.poll_votes FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can view all speeches" ON public.student_speeches;
CREATE POLICY "Super admins can view all speeches"
  ON public.student_speeches FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can view all student awards" ON public.student_awards;
CREATE POLICY "Super admins can view all student awards"
  ON public.student_awards FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can view all assessments" ON public.assessments;
CREATE POLICY "Super admins can view all assessments"
  ON public.assessments FOR SELECT
  TO authenticated
  USING (public.is_super_admin());
