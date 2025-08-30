-- Enable real-time for poll_votes table
ALTER TABLE public.poll_votes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;

-- Enable real-time for polls table  
ALTER TABLE public.polls REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;