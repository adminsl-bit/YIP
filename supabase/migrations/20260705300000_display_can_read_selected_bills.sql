-- Allow the unauthenticated display screen to read bills in the discussion queue.
-- Same pattern as polls RLS fix (20260704100000).

DROP POLICY IF EXISTS "View own or shared event documents" ON public.student_documents;

CREATE POLICY "View own or shared event documents"
  ON public.student_documents
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.user_type = ANY (ARRAY['organizer'::user_type, 'jury'::user_type])
        AND p.event_id = student_documents.event_id
    )
    OR (
      has_role(auth.uid(), 'admin_student'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.event_id = student_documents.event_id
      )
    )
    OR (
      is_shared = true
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.event_id = student_documents.event_id
      )
    )
    -- Unauthenticated display screen can see bills queued for discussion
    OR (is_selected = true AND auth.role() = 'anon')
  );
