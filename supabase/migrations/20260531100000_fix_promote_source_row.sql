-- Fix: upsert the SOURCE event row with is_current=false and promoted_at=now()
-- so the leaderboard can detect already-promoted students across sessions.
-- Previously only a plain UPDATE was done (no promoted_at set, no INSERT if row missing).
CREATE OR REPLACE FUNCTION public.promote_participants(
  p_user_ids     UUID[],
  p_from_event   UUID,
  p_to_event     UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is organizer or super_admin
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND user_type IN ('organizer', 'super_admin')
    )
  ) THEN
    RAISE EXCEPTION 'Only organizers can promote participants';
  END IF;

  -- Upsert source event row: mark as no longer current and record promoted_at
  INSERT INTO public.event_participants (event_id, user_id, is_current, promoted_at)
  SELECT p_from_event, uid, false, now()
  FROM unnest(p_user_ids) AS uid
  ON CONFLICT (event_id, user_id) DO UPDATE
    SET is_current   = false,
        promoted_at  = now();

  -- Upsert into target event
  INSERT INTO public.event_participants
    (event_id, user_id, promoted_from_event_id, is_current, promoted_at)
  SELECT
    p_to_event,
    uid,
    p_from_event,
    true,
    now()
  FROM unnest(p_user_ids) AS uid
  ON CONFLICT (event_id, user_id) DO UPDATE
    SET is_current             = true,
        promoted_from_event_id = p_from_event,
        promoted_at            = now();

  -- Update profiles.event_id so all event-scoped queries reflect the promotion
  UPDATE public.profiles
  SET event_id = p_to_event
  WHERE user_id = ANY(p_user_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_participants(UUID[], UUID, UUID) TO authenticated;
