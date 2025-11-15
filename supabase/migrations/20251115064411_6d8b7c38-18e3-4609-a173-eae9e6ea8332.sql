-- Drop the old unique constraints that don't include session_id
-- These are preventing jury from assessing the same student across different sessions
ALTER TABLE public.assessments DROP CONSTRAINT IF EXISTS unique_jury_student;
ALTER TABLE public.assessments DROP CONSTRAINT IF EXISTS assessments_jury_student_unique;

-- Verify the correct constraint with session_id remains
-- assessments_jury_student_session_unique (jury_id, student_id, session_id) should be the only unique constraint