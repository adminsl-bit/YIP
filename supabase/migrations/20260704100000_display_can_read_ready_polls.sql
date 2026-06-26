-- The open display screen runs unauthenticated (anon role).
-- The existing SELECT policy only exposes is_active=true polls to anon,
-- so the "Voting Opens Soon / ready" state was invisible to the display.
--
-- Allow anon to read polls that are created but not yet started
-- (is_active=false, show_post_analysis=false). These have zero votes
-- so nothing sensitive is leaked — only the question title and options.

DROP POLICY IF EXISTS "Everyone can view active polls or polls in active sessions" ON public.polls;
DROP POLICY IF EXISTS "Everyone can view active polls" ON public.polls;

CREATE POLICY "Everyone can view polls"
ON public.polls
FOR SELECT
USING (
  -- Active (voting open) — visible to everyone
  is_active = true
  -- Ready/staged (created but not started) — visible to anon display + organizers
  OR (show_post_analysis = false AND (
    auth.role() = 'anon'
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND user_type IN ('organizer', 'super_admin', 'jury')
    )
  ))
  -- Post-analysis — visible to organizers and jury
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND user_type IN ('organizer', 'super_admin', 'jury')
  )
  -- Linked to an active session item — visible to everyone
  OR EXISTS (
    SELECT 1 FROM public.session_items
    WHERE poll_id = polls.id AND is_active = true
  )
);
