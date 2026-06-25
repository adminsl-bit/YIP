-- Organizers had SELECT + UPDATE on assessments but no DELETE policy.
-- The "Reset All Scores" button was silently blocked by RLS.

CREATE POLICY "Organizers can delete assessments"
ON public.assessments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND user_type IN ('organizer', 'super_admin')
  )
);
