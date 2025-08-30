-- Ensure unique constraint to support UPSERT on (jury_id, student_id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assessments_jury_student_unique'
  ) THEN
    ALTER TABLE public.assessments
    ADD CONSTRAINT assessments_jury_student_unique UNIQUE (jury_id, student_id);
  END IF;
END $$;