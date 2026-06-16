-- Fix list_events_for_super_admin to count only student profiles,
-- not all profiles (which previously included organizers and jury).
CREATE OR REPLACE FUNCTION public.list_events_for_super_admin()
RETURNS TABLE (
  id             uuid,
  name           text,
  level          text,
  city           text,
  state          text,
  zone           text,
  parent_event_id uuid,
  status         text,
  participant_count bigint,
  created_at     timestamptz
)
LANGUAGE sql
SECURITY DEFINER
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
    (SELECT COUNT(*) FROM public.profiles p WHERE p.event_id = e.id AND p.user_type = 'student') AS participant_count,
    e.created_at
  FROM public.events e
  ORDER BY e.level DESC, e.created_at DESC;
$$;
