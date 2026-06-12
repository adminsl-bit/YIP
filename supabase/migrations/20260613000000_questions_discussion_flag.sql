-- Question Hour: lets a Minister flag one question from their portfolio as
-- "under discussion" so it can be highlighted live for every delegate and
-- the minister themselves, across the Trending feed and My Questions inbox.
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS is_discussing boolean NOT NULL DEFAULT false;

-- Ministers (and Shadow Ministers) can toggle the discussion flag for
-- questions addressed to their own portfolio. Ministry → position match is
-- derived the same way the client does ("Ministry of X" <-> "Minister of X").
CREATE POLICY "Ministers can flag portfolio questions for discussion"
ON public.questions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.position ILIKE ('%minister of ' || substring(questions.ministry from 'Ministry of (.*)') || '%')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.position ILIKE ('%minister of ' || substring(questions.ministry from 'Ministry of (.*)') || '%')
  )
);
