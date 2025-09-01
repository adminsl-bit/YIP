-- Create a secure function to expose jury names to authenticated users without exposing full profiles
CREATE OR REPLACE FUNCTION public.get_jury_directory()
RETURNS TABLE (user_id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, name
  FROM public.profiles
  WHERE user_type = 'jury';
$$;

-- Restrict default PUBLIC execute and grant to authenticated users only
REVOKE ALL ON FUNCTION public.get_jury_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_jury_directory() TO authenticated;