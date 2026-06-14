-- Adds a "discussion queue" to student_documents (bills).
-- Organizers/jury/super admins mark bills as selected for discussion
-- (is_selected), order them (discussion_order), and a single bill is
-- "now discussing" (is_discussing) at a time — advanced manually via the
-- organizer UI like a pointer through the ordered queue.

ALTER TABLE public.student_documents ADD COLUMN IF NOT EXISTS is_selected BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.student_documents ADD COLUMN IF NOT EXISTS discussion_order INT;
ALTER TABLE public.student_documents ADD COLUMN IF NOT EXISTS is_discussing BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_student_documents_discussion
  ON public.student_documents(event_id, is_selected, discussion_order);

-- Admin students (students with the admin_student app role) can see every
-- document for their own event, not just their own — needed to build the
-- discussion queue from the same table organizers use.
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
    OR (
      public.has_role(auth.uid(), 'admin_student'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.event_id = student_documents.event_id
      )
    )
  );

-- Organizers/jury (scoped to their event), admin students (scoped to their
-- event), and super admins can update the discussion-queue fields on any
-- document for their event.
DROP POLICY IF EXISTS "Manage discussion queue (organizer/jury/admin)" ON public.student_documents;
CREATE POLICY "Manage discussion queue (organizer/jury/admin)"
  ON public.student_documents FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.user_type IN ('organizer', 'jury')
        AND p.event_id = student_documents.event_id
    )
    OR (
      public.has_role(auth.uid(), 'admin_student'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.event_id = student_documents.event_id
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.user_type IN ('organizer', 'jury')
        AND p.event_id = student_documents.event_id
    )
    OR (
      public.has_role(auth.uid(), 'admin_student'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.event_id = student_documents.event_id
      )
    )
  );
