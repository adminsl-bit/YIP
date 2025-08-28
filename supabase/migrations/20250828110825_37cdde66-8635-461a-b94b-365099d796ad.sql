-- Enable real-time updates for timer_sessions table
ALTER TABLE public.timer_sessions REPLICA IDENTITY FULL;

-- Add timer_sessions table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.timer_sessions;