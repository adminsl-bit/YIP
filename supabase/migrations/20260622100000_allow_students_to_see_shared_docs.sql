-- Allow students to see documents that have been explicitly shared (is_shared=true)
-- within their own event. Previously only organisers/jury could see other users' docs.
DROP POLICY IF EXISTS "View own or event documents (organizer/jury/admin)" ON public.student_documents;

CREATE POLICY "View own or shared event documents"
  ON public.student_documents
  FOR SELECT
  USING (
    -- Own documents
    user_id = auth.uid()
    -- Super admin sees all
    OR is_super_admin()
    -- Organizer / jury sees all docs in their event
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.user_type = ANY (ARRAY['organizer'::user_type, 'jury'::user_type])
        AND p.event_id = student_documents.event_id
    )
    -- Admin student sees all docs in their event
    OR (
      has_role(auth.uid(), 'admin_student'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.event_id = student_documents.event_id
      )
    )
    -- Any student can see shared documents within their event
    OR (
      is_shared = true
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.event_id = student_documents.event_id
      )
    )
  );
