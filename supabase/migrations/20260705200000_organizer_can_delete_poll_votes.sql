-- Organizers had SELECT on poll_votes but no DELETE policy.
-- The "Reset Votes" button was silently deleting 0 rows (RLS blocked it).

CREATE POLICY "Organizers can delete poll votes"
ON public.poll_votes
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND user_type IN ('organizer', 'super_admin')
  )
);
