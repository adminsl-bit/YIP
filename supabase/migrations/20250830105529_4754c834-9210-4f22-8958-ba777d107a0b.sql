-- Add a public function to get total student count for participation stats
-- This allows stage display to show proper participation without exposing student details

CREATE OR REPLACE FUNCTION public.get_total_active_students()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER 
  FROM public.profiles 
  WHERE user_type = 'student' AND is_active = true;
$$;

-- Grant access to anonymous users for this function
GRANT EXECUTE ON FUNCTION public.get_total_active_students() TO anon;