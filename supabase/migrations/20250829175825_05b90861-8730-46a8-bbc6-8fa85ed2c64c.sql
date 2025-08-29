-- Create awards table to store available awards
CREATE TABLE public.awards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Insert the award list
INSERT INTO public.awards (name, description) VALUES
('Best Parliamentarian Award', 'Outstanding performance in parliamentary procedures'),
('Best Speaker Award', 'Excellence in public speaking and communication'),
('Best Debator Award', 'Superior debating skills and argumentation'),
('Leadership Excellence Award', 'Exceptional leadership qualities'),
('Innovative Ideas Award', 'Creative and innovative thinking'),
('Community Impact Award', 'Significant positive impact on community'),
('Most Valuable Participant', 'Overall outstanding contribution'),
('Team Spirit Award', 'Exceptional teamwork and collaboration'),
('Best Leader of the House', 'Outstanding house leadership'),
('Most Persuasive Award', 'Exceptional persuasive abilities');

-- Create award votes table for jury voting on awards
CREATE TABLE public.award_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  award_id uuid NOT NULL REFERENCES public.awards(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  jury_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(award_id, student_id, jury_id)
);

-- Create student awards table for tracking assigned awards
CREATE TABLE public.student_awards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL,
  award_id uuid NOT NULL REFERENCES public.awards(id) ON DELETE CASCADE,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  assigned_by_jury_consensus boolean NOT NULL DEFAULT true,
  UNIQUE(student_id, award_id)
);

-- Enable RLS on new tables
ALTER TABLE public.awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.award_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_awards ENABLE ROW LEVEL SECURITY;

-- RLS policies for awards table
CREATE POLICY "Awards are viewable by authenticated users" 
ON public.awards 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- RLS policies for award_votes table
CREATE POLICY "Jury can view all award votes" 
ON public.award_votes 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND user_type = 'jury'::user_type
));

CREATE POLICY "Organizers can view all award votes" 
ON public.award_votes 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND user_type = 'organizer'::user_type
));

CREATE POLICY "Jury can cast award votes" 
ON public.award_votes 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND user_type = 'jury'::user_type 
  AND user_id = award_votes.jury_id
));

CREATE POLICY "Jury can update their own award votes" 
ON public.award_votes 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND user_type = 'jury'::user_type 
  AND user_id = award_votes.jury_id
));

CREATE POLICY "Jury can delete their own award votes" 
ON public.award_votes 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND user_type = 'jury'::user_type 
  AND user_id = award_votes.jury_id
));

-- RLS policies for student_awards table
CREATE POLICY "Everyone can view student awards" 
ON public.student_awards 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only organizers can manage student awards" 
ON public.student_awards 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND user_type = 'organizer'::user_type
));

-- Create function to check if all three juries voted for an award
CREATE OR REPLACE FUNCTION public.check_award_consensus(p_award_id uuid, p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT (
    SELECT COUNT(DISTINCT jury_id) 
    FROM public.award_votes 
    WHERE award_id = p_award_id 
    AND student_id = p_student_id
  ) >= 3;
$$;

-- Create function to automatically assign awards when consensus is reached
CREATE OR REPLACE FUNCTION public.assign_award_on_consensus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if consensus is reached (3 jury votes)
  IF check_award_consensus(NEW.award_id, NEW.student_id) THEN
    -- Check if award hasn't been assigned yet
    IF NOT EXISTS (
      SELECT 1 FROM public.student_awards 
      WHERE award_id = NEW.award_id 
      AND student_id = NEW.student_id
    ) THEN
      -- Assign the award
      INSERT INTO public.student_awards (award_id, student_id)
      VALUES (NEW.award_id, NEW.student_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic award assignment
CREATE TRIGGER trigger_assign_award_on_consensus
  AFTER INSERT OR UPDATE ON public.award_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_award_on_consensus();

-- Create a view for jury leaderboard with averaged scores
CREATE OR REPLACE VIEW public.jury_leaderboard AS
SELECT 
  p.user_id,
  p.name,
  p.position,
  p.party_number,
  p.constituency,
  p.state,
  p.city,
  p.photo_url,
  COALESCE(AVG(a.total_score), 0) as average_score,
  COUNT(a.id) as assessment_count,
  ARRAY_AGG(DISTINCT sa.award_id) FILTER (WHERE sa.award_id IS NOT NULL) as award_ids
FROM public.profiles p
LEFT JOIN public.assessments a ON p.user_id = a.student_id AND a.status = 'submitted'
LEFT JOIN public.student_awards sa ON p.user_id = sa.student_id
WHERE p.user_type = 'student'
GROUP BY p.user_id, p.name, p.position, p.party_number, p.constituency, p.state, p.city, p.photo_url
ORDER BY average_score DESC;