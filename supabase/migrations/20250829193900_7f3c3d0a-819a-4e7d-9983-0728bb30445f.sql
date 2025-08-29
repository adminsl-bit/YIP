-- Allow organizers to manage awards (create, update, delete)
CREATE POLICY "Organizers can manage awards" 
ON public.awards 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE user_id = auth.uid() 
  AND user_type = 'organizer'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE user_id = auth.uid() 
  AND user_type = 'organizer'
));

-- Update student_awards table to allow manual assignment (not just consensus)
ALTER TABLE public.student_awards 
ADD COLUMN assigned_by_organizer boolean DEFAULT false,
ADD COLUMN assigned_by_user_id uuid REFERENCES auth.users(id);

-- Create index for better performance
CREATE INDEX idx_student_awards_assigned_by ON public.student_awards(assigned_by_user_id);
CREATE INDEX idx_awards_name ON public.awards(name);