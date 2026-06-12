-- Admin students and journalists sit outside party politics: they should
-- always be Non-Aligned (and have no party), so they render in the
-- "Non-Aligned & Independent" bench of the Parliament Tree rather than under
-- Government/Opposition.
UPDATE public.profiles
SET party_alignment = 'non_aligned'
WHERE user_type = 'student'
  AND (position ILIKE '%journalist%' OR position ILIKE '%admin%')
  AND party_alignment <> 'non_aligned';
