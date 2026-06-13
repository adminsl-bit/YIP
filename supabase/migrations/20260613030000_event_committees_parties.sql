-- Event-scoped committee & party configuration.
-- Replaces the hardcoded PARLIAMENT_COMMITTEES (5 committees) and the global
-- assignment_parties system_settings row (5 parties) with per-event tables
-- that SuperAdmins can configure when creating/editing an event.

CREATE TABLE IF NOT EXISTS public.event_committees (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id      UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  display_order INT  NOT NULL DEFAULT 0,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_parties (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id      UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  display_order INT  NOT NULL DEFAULT 0,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_committees_event_id ON public.event_committees(event_id, display_order);
CREATE INDEX IF NOT EXISTS idx_event_parties_event_id    ON public.event_parties(event_id, display_order);

ALTER TABLE public.event_committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_parties    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage event committees"
  ON public.event_committees FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "Authenticated users view event committees"
  ON public.event_committees FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins manage event parties"
  ON public.event_parties FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "Authenticated users view event parties"
  ON public.event_parties FOR SELECT TO authenticated USING (true);

-- Backfill: every existing event without committee/party rows gets the
-- current canonical 5+5 as its starting configuration.
INSERT INTO public.event_committees (event_id, name, display_order)
SELECT e.id, c.name, c.idx
FROM public.events e
CROSS JOIN (VALUES
  ('IT & Education', 0),
  ('Women and Child Safety', 1),
  ('Health & Sports', 2),
  ('Environment & Road Transport', 3),
  ('Tourism and Culture', 4)
) AS c(name, idx)
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_committees ec WHERE ec.event_id = e.id
);

INSERT INTO public.event_parties (event_id, name, display_order)
SELECT e.id, p.name, p.idx
FROM public.events e
CROSS JOIN (VALUES
  ('Party A', 0),
  ('Party B', 1),
  ('Party C', 2),
  ('Party D', 3),
  ('Party E', 4)
) AS p(name, idx)
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_parties ep WHERE ep.event_id = e.id
);

-- Round-robin reassign an event's existing students across its current
-- event_committees/event_parties lists. Called by the SuperAdmin UI after
-- editing an event's committee/party configuration.
CREATE OR REPLACE FUNCTION public.reassign_event_committees_parties(p_event_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  committee_count INT;
  party_count     INT;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can reassign committees/parties';
  END IF;

  SELECT COUNT(*) INTO committee_count FROM public.event_committees WHERE event_id = p_event_id;
  SELECT COUNT(*) INTO party_count     FROM public.event_parties    WHERE event_id = p_event_id;

  IF committee_count > 0 THEN
    WITH ordered_committees AS (
      SELECT name, (ROW_NUMBER() OVER (ORDER BY display_order, id) - 1) AS idx
      FROM public.event_committees WHERE event_id = p_event_id
    ),
    ordered_students AS (
      SELECT user_id,
             (ROW_NUMBER() OVER (ORDER BY serial_number, user_id) - 1) AS rn
      FROM public.profiles
      WHERE event_id = p_event_id
        AND user_type = 'student'
        AND position NOT IN ('Admin Student', 'Journalist')
    )
    UPDATE public.profiles p
    SET committee = oc.name
    FROM ordered_students os
    JOIN ordered_committees oc ON oc.idx = (os.rn % committee_count)
    WHERE p.user_id = os.user_id;
  END IF;

  IF party_count > 0 THEN
    WITH ordered_parties AS (
      SELECT name, (ROW_NUMBER() OVER (ORDER BY display_order, id) - 1) AS idx
      FROM public.event_parties WHERE event_id = p_event_id
    ),
    ordered_students AS (
      SELECT user_id,
             (ROW_NUMBER() OVER (ORDER BY serial_number, user_id) - 1) AS rn
      FROM public.profiles
      WHERE event_id = p_event_id
        AND user_type = 'student'
        AND position NOT IN ('Admin Student', 'Journalist')
    ),
    ruling_threshold AS (
      SELECT FLOOR(party_count / 2.0)::int + 1 AS threshold
    )
    UPDATE public.profiles p
    SET party_name      = op.name,
        party_number    = op.idx + 1,
        party_alignment = CASE WHEN (op.idx + 1) <= rt.threshold
                                THEN 'ruling_party' ELSE 'opposition' END
    FROM ordered_students os
    JOIN ordered_parties op ON op.idx = (os.rn % party_count)
    CROSS JOIN ruling_threshold rt
    WHERE p.user_id = os.user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reassign_event_committees_parties(UUID) TO authenticated;
