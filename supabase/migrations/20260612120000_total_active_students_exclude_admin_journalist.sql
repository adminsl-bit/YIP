-- Align get_total_active_students() with the delegate definition used
-- elsewhere (AnalyticsBento, DetailedPollResults): exclude journalists and
-- administrators/admin students from the "Total Delegates" / turnout base
-- shown on the public poll display, so counts match across views.
CREATE OR REPLACE FUNCTION public.get_total_active_students()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.profiles
  WHERE user_type = 'student'
    AND is_active = true
    AND COALESCE(position, '') NOT ILIKE '%journalist%'
    AND COALESCE(position, '') NOT ILIKE '%admin%';
$$;
