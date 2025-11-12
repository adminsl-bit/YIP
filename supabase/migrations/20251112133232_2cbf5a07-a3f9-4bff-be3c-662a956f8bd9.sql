-- Create student_speeches table to track each time a student speaks
CREATE TABLE public.student_speeches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  recorded_by UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  session_info TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster queries
CREATE INDEX idx_student_speeches_student_id ON public.student_speeches(student_id);
CREATE INDEX idx_student_speeches_recorded_at ON public.student_speeches(recorded_at DESC);

-- Enable Row Level Security
ALTER TABLE public.student_speeches ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Organizers and admin students can view all speeches
CREATE POLICY "Organizers and admin students can view speeches"
ON public.student_speeches
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid() 
    AND profiles.user_type = 'organizer'
  )
  OR (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid() 
      AND profiles.user_type = 'student'
    )
    AND has_role(auth.uid(), 'admin_student')
  )
);

-- Admin students can insert speech records
CREATE POLICY "Admin students can insert speeches"
ON public.student_speeches
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid() 
    AND profiles.user_type = 'student'
  )
  AND has_role(auth.uid(), 'admin_student')
  AND recorded_by = auth.uid()
);

-- Admin students can delete their own speech records (undo mistakes)
CREATE POLICY "Admin students can delete own speeches"
ON public.student_speeches
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid() 
    AND profiles.user_type = 'student'
  )
  AND has_role(auth.uid(), 'admin_student')
  AND recorded_by = auth.uid()
);

-- Organizers can manage all speeches
CREATE POLICY "Organizers can manage speeches"
ON public.student_speeches
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid() 
    AND profiles.user_type = 'organizer'
  )
);

-- Enable realtime for live updates
ALTER TABLE public.student_speeches REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_speeches;

-- Create a view for admin dashboard with aggregated data
CREATE OR REPLACE VIEW public.admin_student_dashboard AS
SELECT 
  p.user_id,
  p.serial_number,
  p.name,
  p.position,
  p.party_number,
  p.party_name,
  p.constituency,
  p.state,
  p.city,
  p.photo_url,
  p.is_active,
  -- Count of speeches
  COALESCE(COUNT(DISTINCT ss.id), 0)::INTEGER as speech_count,
  -- Last speech time
  MAX(ss.recorded_at) as last_speech_at,
  -- Check if student has been scored by any jury
  EXISTS (
    SELECT 1 FROM public.assessments a 
    WHERE a.student_id = p.user_id
  ) as has_jury_score,
  -- Count of jury assessments
  COALESCE(
    (SELECT COUNT(*) FROM public.assessments a WHERE a.student_id = p.user_id),
    0
  )::INTEGER as assessment_count,
  -- Average score from assessments
  COALESCE(
    (SELECT AVG(total_score) FROM public.assessments a WHERE a.student_id = p.user_id),
    0
  )::NUMERIC as average_score
FROM public.profiles p
LEFT JOIN public.student_speeches ss ON ss.student_id = p.user_id
WHERE p.user_type = 'student' AND p.is_active = true
GROUP BY p.user_id, p.serial_number, p.name, p.position, p.party_number, 
         p.party_name, p.constituency, p.state, p.city, p.photo_url, p.is_active;

-- Grant access to the view
GRANT SELECT ON public.admin_student_dashboard TO authenticated;