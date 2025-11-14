-- Drop the old unique constraint that doesn't include session_id
ALTER TABLE public.assessments 
DROP CONSTRAINT IF EXISTS assessments_jury_id_student_id_key;

-- The new constraint with session_id (assessments_jury_student_session_unique) is already in place
-- This allows the same jury to assess the same student multiple times across different sessions