-- Add jury_id column to assessment_locks table for per-jury locking
ALTER TABLE public.assessment_locks 
ADD COLUMN IF NOT EXISTS jury_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_assessment_locks_jury_id ON public.assessment_locks(jury_id);
CREATE INDEX IF NOT EXISTS idx_assessment_locks_is_global ON public.assessment_locks(is_global_lock);

-- Create function to check if a jury member's assessments are locked
CREATE OR REPLACE FUNCTION public.is_jury_assessment_locked(p_jury_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Check if there's a global lock or a specific jury lock
  SELECT EXISTS (
    SELECT 1 FROM public.assessment_locks
    WHERE is_global_lock = true
    OR (jury_id = p_jury_id AND is_global_lock = false)
  );
$$;

-- Update RLS policy for assessments to respect locks
DROP POLICY IF EXISTS "Jury can update their own assessments" ON public.assessments;

CREATE POLICY "Jury can update their own assessments"
ON public.assessments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.user_type = 'jury'
    AND profiles.user_id = assessments.jury_id
  )
  AND NOT is_jury_assessment_locked(auth.uid())
);