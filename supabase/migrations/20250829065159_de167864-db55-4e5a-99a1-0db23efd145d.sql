-- Drop the problematic RLS policies that cause infinite recursion
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public can view basic student info" ON public.profiles;
DROP POLICY IF EXISTS "Jury can view student profiles" ON public.profiles;
DROP POLICY IF EXISTS "Organizers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create non-recursive RLS policies
-- Users can view their own profile (direct auth.uid() check)
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own profile (direct auth.uid() check)  
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id);

-- Public can view basic student info (simplified check)
CREATE POLICY "Public can view basic student info"
ON public.profiles
FOR SELECT
USING (user_type = 'student' AND auth.uid() IS NOT NULL);

-- Create a security definer function to check user type without recursion
CREATE OR REPLACE FUNCTION public.get_current_user_type()
RETURNS user_type
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT user_type FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Jury can view student profiles (using function to avoid recursion)
CREATE POLICY "Jury can view student profiles"
ON public.profiles
FOR SELECT
USING (
  user_type = 'student' 
  AND public.get_current_user_type() = 'jury'
);

-- Organizers can view all profiles (using function to avoid recursion)
CREATE POLICY "Organizers can view all profiles"
ON public.profiles
FOR SELECT
USING (public.get_current_user_type() = 'organizer');