-- 1) Normalize assessments.student_id to always reference profiles.user_id
UPDATE public.assessments a
SET student_id = p.user_id
FROM public.profiles p
WHERE a.student_id = p.id;

-- 2) Remove duplicate assessments keeping the latest per (jury_id, student_id)
DELETE FROM public.assessments a
USING public.assessments b
WHERE a.jury_id = b.jury_id
  AND a.student_id = b.student_id
  AND a.updated_at < b.updated_at;

-- 3) Enforce uniqueness at the DB level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'unique_jury_student' AND conrelid = 'public.assessments'::regclass
  ) THEN
    ALTER TABLE public.assessments
    ADD CONSTRAINT unique_jury_student UNIQUE (jury_id, student_id);
  END IF;
END $$;

-- 4) RLS: Allow jury to update their own assessments regardless of status
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
