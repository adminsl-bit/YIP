-- Allow organizers to update student profiles (needed for photo uploads)
CREATE POLICY "Organizers can update student profiles" 
ON public.profiles 
FOR UPDATE 
USING (
  user_type = 'student'::user_type 
  AND get_current_user_type() = 'organizer'::user_type
);