-- Create assessments table to store jury evaluations
CREATE TABLE public.assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  jury_id UUID NOT NULL,
  student_id UUID NOT NULL,
  seat_role TEXT NOT NULL CHECK (seat_role IN ('speaker', 'deputy_speaker', 'mp')),
  scores JSONB NOT NULL DEFAULT '{}',
  total_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'locked')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(jury_id, student_id)
);

-- Create assessment locks table to track global assessment status
CREATE TABLE public.assessment_locks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  locked_by UUID NOT NULL,
  locked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_global_lock BOOLEAN NOT NULL DEFAULT false,
  reason TEXT
);

-- Enable RLS
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_locks ENABLE ROW LEVEL SECURITY;

-- Policies for assessments
CREATE POLICY "Jury can view their own assessments" 
ON public.assessments 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE user_id = auth.uid() AND user_type = 'jury' AND user_id = assessments.jury_id
));

CREATE POLICY "Jury can create their own assessments" 
ON public.assessments 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE user_id = auth.uid() AND user_type = 'jury' AND user_id = assessments.jury_id
));

CREATE POLICY "Jury can update their own draft assessments" 
ON public.assessments 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE user_id = auth.uid() AND user_type = 'jury' AND user_id = assessments.jury_id
) AND status = 'draft');

CREATE POLICY "Organizers can view all assessments" 
ON public.assessments 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE user_id = auth.uid() AND user_type = 'organizer'
));

CREATE POLICY "Organizers can manage assessment locks" 
ON public.assessments 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE user_id = auth.uid() AND user_type = 'organizer'
));

-- Policies for assessment locks
CREATE POLICY "Everyone can view assessment locks" 
ON public.assessment_locks 
FOR SELECT 
USING (true);

CREATE POLICY "Only organizers can manage locks" 
ON public.assessment_locks 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE user_id = auth.uid() AND user_type = 'organizer'
));

-- Add triggers for timestamps
CREATE TRIGGER update_assessments_updated_at
BEFORE UPDATE ON public.assessments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add function to calculate total score from JSON scores
CREATE OR REPLACE FUNCTION public.calculate_total_score(scores_json JSONB)
RETURNS INTEGER AS $$
DECLARE
  total INTEGER := 0;
  category_key TEXT;
  category_value JSONB;
BEGIN
  FOR category_key, category_value IN SELECT * FROM jsonb_each(scores_json)
  LOOP
    IF jsonb_typeof(category_value) = 'number' THEN
      total := total + (category_value::TEXT)::INTEGER;
    ELSIF jsonb_typeof(category_value) = 'object' THEN
      -- Handle nested scoring (like subcategories in MP rubric)
      total := total + (SELECT sum((value::TEXT)::INTEGER) FROM jsonb_each_text(category_value));
    END IF;
  END LOOP;
  
  RETURN total;
END;
$$ LANGUAGE plpgsql IMMUTABLE;