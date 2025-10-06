-- Drop the restrictive organizer-only policy for viewing poll votes
DROP POLICY IF EXISTS "Organizers can view all votes" ON poll_votes;

-- Create a new policy that allows organizers AND admin students to view all votes
CREATE POLICY "Organizers and admin students can view all votes" 
ON poll_votes 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid() 
    AND profiles.user_type = 'organizer'
  )
  OR (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid() 
      AND profiles.user_type = 'student'
    )
    AND has_role(auth.uid(), 'admin_student'::app_role)
  )
);