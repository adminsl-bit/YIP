-- Fix: list_events_for_super_admin() undercounts participants.
--
-- It previously derived participant_count from event_participants, a table that
-- is only populated for users created via SuperAdminRoleCreator (organizer/jury
-- bulk-create) and the original default-event backfill. Students who self-register
-- via Onboarding get profiles.event_id set directly and never get an
-- event_participants row, so non-default events showed only their handful of
-- staff accounts as "participants".
--
-- profiles.event_id is the source of truth used everywhere else (e.g.
-- get_event_leaderboard), so count from there instead.

CREATE OR REPLACE FUNCTION public.list_events_for_super_admin()
RETURNS TABLE (
  id               UUID,
  name             TEXT,
  level            TEXT,
  city             TEXT,
  state            TEXT,
  parent_event_id  UUID,
  status           TEXT,
  participant_count BIGINT,
  created_at       TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.name,
    e.level,
    e.city,
    e.state,
    e.parent_event_id,
    e.status,
    (SELECT COUNT(*) FROM public.profiles p WHERE p.event_id = e.id) AS participant_count,
    e.created_at
  FROM public.events e
  ORDER BY e.level DESC, e.created_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.list_events_for_super_admin() TO authenticated;
