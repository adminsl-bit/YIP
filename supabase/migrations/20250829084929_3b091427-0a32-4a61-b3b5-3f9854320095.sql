-- First, let's clean up the duplicate assessments manually
WITH ranked_assessments AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY jury_id, student_id 
           ORDER BY updated_at DESC
         ) as rn
  FROM public.assessments
)
DELETE FROM public.assessments 
WHERE id IN (
  SELECT id FROM ranked_assessments WHERE rn > 1
);

-- Now add the unique constraint
ALTER TABLE public.assessments 
ADD CONSTRAINT unique_jury_student UNIQUE (jury_id, student_id);

-- Update RLS policy to allow jury to update their own assessments
DROP POLICY IF EXISTS "Jury can update their own draft assessments" ON public.assessments;

CREATE POLICY "Jury can update their own assessments"
ON public.assessments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.user_type = 'jury'::user_type
      AND profiles.user_id = public.assessments.jury_id
  )
);