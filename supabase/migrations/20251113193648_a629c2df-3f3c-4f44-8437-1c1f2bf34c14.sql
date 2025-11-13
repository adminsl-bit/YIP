-- Enable realtime for poll-related tables so stage display updates instantly
-- Set REPLICA IDENTITY FULL for complete row data on updates
ALTER TABLE public.polls REPLICA IDENTITY FULL;
ALTER TABLE public.poll_votes REPLICA IDENTITY FULL;
ALTER TABLE public.session_items REPLICA IDENTITY FULL;
ALTER TABLE public.session_sub_items REPLICA IDENTITY FULL;

-- Add tables to supabase_realtime publication if not already present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'polls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'poll_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'session_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.session_items;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'session_sub_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.session_sub_items;
  END IF;
END $$;