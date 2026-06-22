-- Allows organizers to mark documents as shared so all students in the
-- event can view and download them from their "Shared" documents tab.
ALTER TABLE public.student_documents
  ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_student_documents_shared
  ON public.student_documents (event_id, is_shared)
  WHERE is_shared = true;
