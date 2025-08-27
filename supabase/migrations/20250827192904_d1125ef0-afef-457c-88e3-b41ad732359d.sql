-- Create voting sessions table to control when voting is enabled
CREATE TABLE public.voting_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('general', 'community')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Create votes table to store individual votes
CREATE TABLE public.votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voting_session_id UUID NOT NULL REFERENCES public.voting_sessions(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL,
  vote_choice TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(voting_session_id, voter_id)
);

-- Enable RLS on both tables
ALTER TABLE public.voting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- Policies for voting_sessions
CREATE POLICY "Everyone can view voting sessions" 
ON public.voting_sessions 
FOR SELECT 
USING (true);

CREATE POLICY "Only organizers can manage voting sessions" 
ON public.voting_sessions 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE user_id = auth.uid() AND user_type = 'organizer'
));

-- Policies for votes
CREATE POLICY "Users can view their own votes" 
ON public.votes 
FOR SELECT 
USING (auth.uid() = voter_id);

CREATE POLICY "Users can cast their own votes" 
ON public.votes 
FOR INSERT 
WITH CHECK (auth.uid() = voter_id);

CREATE POLICY "Organizers can view all votes" 
ON public.votes 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE user_id = auth.uid() AND user_type = 'organizer'
));

-- Add triggers for timestamps
CREATE TRIGGER update_voting_sessions_updated_at
BEFORE UPDATE ON public.voting_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();