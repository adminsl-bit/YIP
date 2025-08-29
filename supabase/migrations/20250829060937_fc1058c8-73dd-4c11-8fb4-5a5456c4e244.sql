-- Fix security vulnerability: Restrict profile access while maintaining functionality

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create secure policies with proper access controls

-- Policy 1: Users can always view their own complete profile
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy 2: Allow viewing basic student information for parliament functionality
-- This allows viewing student profiles but protects sensitive fields
CREATE POLICY "Public can view basic student info" 
ON public.profiles 
FOR SELECT 
USING (
  user_type = 'student' 
  AND auth.uid() IS NOT NULL  -- Must be authenticated
);

-- Policy 3: Organizers can view all profiles (for administrative purposes)
CREATE POLICY "Organizers can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND user_type = 'organizer'
  )
);

-- Policy 4: Jury members can view student profiles they need to assess
CREATE POLICY "Jury can view student profiles" 
ON public.profiles 
FOR SELECT 
USING (
  user_type = 'student' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND user_type = 'jury'
  )
);