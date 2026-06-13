-- Student Documents / Bills Vault
--
-- Lets students upload PDF/DOCX files (e.g. bills) which they can later
-- run through a client-side extractive "Summarize" preview. Organizers
-- get a table view of every student's uploads for their event.

CREATE TABLE IF NOT EXISTS public.student_documents (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id    UUID REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  file_type   TEXT,
  file_size   BIGINT,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_documents_event_user
  ON public.student_documents(event_id, user_id);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View own or event documents (organizer/jury/admin)" ON public.student_documents;
CREATE POLICY "View own or event documents (organizer/jury/admin)"
  ON public.student_documents FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.user_type IN ('organizer', 'jury')
        AND p.event_id = student_documents.event_id
    )
  );

DROP POLICY IF EXISTS "Upload own documents" ON public.student_documents;
CREATE POLICY "Upload own documents"
  ON public.student_documents FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Delete own or moderate documents" ON public.student_documents;
CREATE POLICY "Delete own or moderate documents"
  ON public.student_documents FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.user_type IN ('organizer', 'jury')
        AND p.event_id = student_documents.event_id
    )
  );

-- ── Realtime ─────────────────────────────────────────────────
ALTER TABLE public.student_documents REPLICA IDENTITY FULL;

-- ALTER PUBLICATION can deadlock against Supabase's realtime replication
-- worker, which concurrently reads the publication. Retry a few times.
DO $$
DECLARE
  attempt INT := 0;
BEGIN
  LOOP
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'student_documents'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.student_documents;
      END IF;
      EXIT;
    EXCEPTION WHEN deadlock_detected OR lock_not_available THEN
      attempt := attempt + 1;
      IF attempt >= 5 THEN
        RAISE;
      END IF;
      PERFORM pg_sleep(1);
    END;
  END LOOP;
END $$;

-- ── Storage bucket for student documents ────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-documents', 'student-documents', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read access for student documents" ON storage.objects;
CREATE POLICY "Public read access for student documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'student-documents');

DROP POLICY IF EXISTS "Users can upload own student documents" ON storage.objects;
CREATE POLICY "Users can upload own student documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'student-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update own student documents" ON storage.objects;
CREATE POLICY "Users can update own student documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'student-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'student-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own student documents" ON storage.objects;
CREATE POLICY "Users can delete own student documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'student-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
