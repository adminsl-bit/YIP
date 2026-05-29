-- RPC accessible to all authenticated users (jury, organizer, student) that returns
-- the user_ids of students who should NOT be scored (admin_student and journalist roles).
-- SECURITY DEFINER bypasses RLS on user_roles so jury users can call this.
CREATE OR REPLACE FUNCTION public.get_non_scoreable_student_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT user_id
  FROM public.user_roles
  WHERE role IN ('admin_student', 'journalist')
$$;

GRANT EXECUTE ON FUNCTION public.get_non_scoreable_student_ids() TO authenticated;
