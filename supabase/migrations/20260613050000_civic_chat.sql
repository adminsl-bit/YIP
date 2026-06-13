-- Civic Chat overhaul: move from ephemeral broadcast-only chat to a
-- persisted, event-scoped table with realtime sync, attachments, and
-- a report-to-organizer moderation flow.
--
-- Channel naming (event-scoped to avoid cross-event collisions):
--   global_<event_id>
--   organizer_<event_id>
--   party_<event_id>_<party_number>
--   committee_<event_id>_<committee_slug>

CREATE TABLE IF NOT EXISTS public.civic_chat_messages (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content         TEXT,
  attachment_url  TEXT,
  attachment_type TEXT,
  attachment_name TEXT,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_reported     BOOLEAN NOT NULL DEFAULT false,
  reported_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_at     TIMESTAMP WITH TIME ZONE,
  report_reason   TEXT
);

CREATE INDEX IF NOT EXISTS idx_civic_chat_messages_channel
  ON public.civic_chat_messages(event_id, channel, created_at);

CREATE INDEX IF NOT EXISTS idx_civic_chat_messages_reported
  ON public.civic_chat_messages(event_id, is_reported) WHERE is_reported = true;

-- ── Access helper ────────────────────────────────────────────
-- Builds the channel names the caller is entitled to (based on their
-- profile) and checks p_channel against them. Super admins, organizers
-- and jury for the event get access to every channel in that event.
CREATE OR REPLACE FUNCTION public.can_access_civic_chat_channel(p_event_id UUID, p_channel TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_event_id     UUID;
  caller_user_type    TEXT;
  caller_party_number INT;
  caller_committee    TEXT;
  committee_slug      TEXT;
BEGIN
  IF public.is_super_admin() THEN
    RETURN true;
  END IF;

  SELECT event_id, user_type, party_number, committee
    INTO caller_event_id, caller_user_type, caller_party_number, caller_committee
  FROM public.profiles
  WHERE user_id = auth.uid();

  IF caller_event_id IS NULL OR caller_event_id <> p_event_id THEN
    RETURN false;
  END IF;

  IF p_channel = 'global_' || p_event_id OR p_channel = 'organizer_' || p_event_id THEN
    RETURN true;
  END IF;

  IF caller_user_type IN ('organizer', 'jury') THEN
    RETURN true;
  END IF;

  IF caller_party_number IS NOT NULL
     AND p_channel = 'party_' || p_event_id || '_' || caller_party_number THEN
    RETURN true;
  END IF;

  IF caller_committee IS NOT NULL THEN
    committee_slug := lower(regexp_replace(caller_committee, '\s+', '_', 'g'));
    IF p_channel = 'committee_' || p_event_id || '_' || committee_slug THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;
GRANT EXECUTE ON FUNCTION public.can_access_civic_chat_channel(UUID, TEXT) TO authenticated;

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.civic_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View accessible civic chat messages"
  ON public.civic_chat_messages FOR SELECT
  TO authenticated
  USING (public.can_access_civic_chat_channel(event_id, channel));

CREATE POLICY "Send civic chat messages to accessible channels"
  ON public.civic_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_access_civic_chat_channel(event_id, channel)
  );

CREATE POLICY "Delete own or moderate civic chat messages"
  ON public.civic_chat_messages FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.event_id = civic_chat_messages.event_id
        AND p.user_type IN ('organizer', 'jury')
    )
  );

-- ── Reporting RPCs (SECURITY DEFINER — no direct UPDATE policy) ─
CREATE OR REPLACE FUNCTION public.report_civic_chat_message(p_message_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg_event_id UUID;
  msg_channel  TEXT;
BEGIN
  SELECT event_id, channel INTO msg_event_id, msg_channel
  FROM public.civic_chat_messages WHERE id = p_message_id;

  IF msg_event_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  IF NOT public.can_access_civic_chat_channel(msg_event_id, msg_channel) THEN
    RAISE EXCEPTION 'Not authorized to report this message';
  END IF;

  UPDATE public.civic_chat_messages
  SET is_reported = true, reported_by = auth.uid(), reported_at = now(), report_reason = p_reason
  WHERE id = p_message_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.report_civic_chat_message(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_civic_chat_report(p_message_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg_event_id UUID;
BEGIN
  SELECT event_id INTO msg_event_id
  FROM public.civic_chat_messages WHERE id = p_message_id;

  IF msg_event_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  IF NOT (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.event_id = msg_event_id
        AND p.user_type IN ('organizer', 'jury')
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to resolve reports';
  END IF;

  UPDATE public.civic_chat_messages
  SET is_reported = false, reported_by = NULL, reported_at = NULL, report_reason = NULL
  WHERE id = p_message_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.resolve_civic_chat_report(UUID) TO authenticated;

-- ── Realtime ─────────────────────────────────────────────────
ALTER TABLE public.civic_chat_messages REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'civic_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.civic_chat_messages;
  END IF;
END $$;

-- ── Storage bucket for chat attachments ─────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for chat attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-attachments');

CREATE POLICY "Users can upload own chat attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own chat attachments"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own chat attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
