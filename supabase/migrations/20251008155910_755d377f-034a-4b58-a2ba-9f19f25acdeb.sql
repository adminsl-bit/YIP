-- Fix jury_leaderboard exposure by restricting student_awards access
-- This prevents students from querying the jury_leaderboard view
-- and seeing assessment statistics

-- Drop the overly permissive "Everyone can view student awards" policy
DROP POLICY IF EXISTS "Everyone can view student awards" ON public.student_awards;

-- Create more restrictive policies for student_awards

-- Students can view their own awards
CREATE POLICY "Students can view their own awards"
ON public.student_awards
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.user_type = 'student'::user_type
    AND profiles.user_id = student_awards.student_id
  )
);

-- Jury can view all student awards (needed for jury dashboard and leaderboard)
CREATE POLICY "Jury can view all student awards"
ON public.student_awards
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.user_type = 'jury'::user_type
  )
);

-- Organizers can view all student awards (needed for organizer dashboard)
CREATE POLICY "Organizers can view all student awards"
ON public.student_awards
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.user_type = 'organizer'::user_type
  )
);