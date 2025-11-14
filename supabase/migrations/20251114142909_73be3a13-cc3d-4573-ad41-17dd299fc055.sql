-- Add session_id to assessments table
ALTER TABLE public.assessments 
ADD COLUMN session_id uuid REFERENCES public.session_items(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_assessments_session_id ON public.assessments(session_id);

-- Drop existing unique constraint if it exists and create new one with session_id
-- First, let's add a unique constraint that includes session_id
-- This allows jury to assess the same student multiple times for different sessions
ALTER TABLE public.assessments 
ADD CONSTRAINT assessments_jury_student_session_unique 
UNIQUE (jury_id, student_id, session_id);

-- Add comment to explain the session-based assessment
COMMENT ON COLUMN public.assessments.session_id IS 'Links assessment to a specific session - jury must assess each student per session';
