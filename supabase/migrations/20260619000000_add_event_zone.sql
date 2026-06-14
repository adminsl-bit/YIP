-- Adds an explicit `zone` column to events (one of the ZoneId values defined
-- in src/lib/regions.ts: north, east, west, northeast, south_tn, south_other).
-- It is auto-filled from the event's state in the UI but stored explicitly so
-- it can be overridden and so list_events_for_super_admin() can return it
-- without re-deriving it from state on every read.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS zone TEXT;

-- Return type (OUT params) is changing, so the old function must be dropped first.
DROP FUNCTION IF EXISTS public.list_events_for_super_admin();

CREATE OR REPLACE FUNCTION public.list_events_for_super_admin()
RETURNS TABLE (
  id               UUID,
  name             TEXT,
  level            TEXT,
  city             TEXT,
  state            TEXT,
  zone             TEXT,
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
    e.zone,
    e.parent_event_id,
    e.status,
    (SELECT COUNT(*) FROM public.profiles p WHERE p.event_id = e.id) AS participant_count,
    e.created_at
  FROM public.events e
  ORDER BY e.level DESC, e.created_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.list_events_for_super_admin() TO authenticated;
