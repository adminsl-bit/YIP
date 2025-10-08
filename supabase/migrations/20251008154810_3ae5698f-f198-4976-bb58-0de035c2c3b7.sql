-- Fix email exposure vulnerability in profiles table
-- Drop the overly permissive "Public can view basic student info" policy
-- and replace with a more restrictive policy that still allows legitimate access

DROP POLICY IF EXISTS "Public can view basic student info" ON public.profiles;

-- Create a new policy that allows students to view other students' basic info
-- Note: Email column will be excluded at application level for student-to-student viewing
-- Legitimate users (jury, organizers, and viewing own profile) can still access email via other policies
CREATE POLICY "Students can view other students basic info"
ON public.profiles
FOR SELECT
USING (
  user_type = 'student'::user_type 
  AND auth.uid() IS NOT NULL
);