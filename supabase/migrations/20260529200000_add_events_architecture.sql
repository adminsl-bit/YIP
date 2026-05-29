-- ================================================================
-- Multi-Tenant Events Architecture
-- Adds: events, event_participants, event_id scoping on all tables,
--       is_super_admin(), get_my_event_id(), promote_participants()
-- Existing single-city data is seeded as event 1 (no data loss).
-- ================================================================

-- ── 0. is_super_admin() must exist before event RLS policies ──
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND user_type = 'super_admin'
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- ── 1. Events table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name             TEXT        NOT NULL,
  level            TEXT        NOT NULL CHECK (level IN ('city', 'regional', 'national')),
  city             TEXT,
  state            TEXT,
  parent_event_id  UUID        REFERENCES public.events(id) ON DELETE SET NULL,
  status           TEXT        NOT NULL DEFAULT 'upcoming'
                               CHECK (status IN ('upcoming', 'active', 'completed')),
  created_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Super admin full control; everyone else read-only
CREATE POLICY "Super admins manage events"
  ON public.events FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Authenticated users view events"
  ON public.events FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 2. Seed event 1 (the current running city event) ─────────
INSERT INTO public.events (id, name, level, status)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'YIP City Parliament 2025',
  'city',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Event participants table ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_participants (
  id                     UUID     NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id               UUID     NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id                UUID     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  promoted_from_event_id UUID     REFERENCES public.events(id) ON DELETE SET NULL,
  is_current             BOOLEAN  NOT NULL DEFAULT true,
  joined_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  promoted_at            TIMESTAMP WITH TIME ZONE,
  UNIQUE(event_id, user_id)
);

ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage participants"
  ON public.event_participants FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Organizers and users view participants"
  ON public.event_participants FOR SELECT
  TO authenticated
  USING (true);

-- Organizers can insert participants (promotion)
CREATE POLICY "Organizers can insert participants"
  ON public.event_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND user_type IN ('organizer', 'super_admin')
    )
  );

CREATE POLICY "Organizers can update participants"
  ON public.event_participants FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND user_type IN ('organizer', 'super_admin')
    )
  );

-- ── 4. Add event_id column to all scoped tables ───────────────
ALTER TABLE public.profiles        ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.assessments     ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.polls           ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.poll_votes      ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.student_speeches ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.award_votes     ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.student_awards  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.session_items   ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.breaking_news   ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.assessment_locks ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

-- civic_posts and questions exist but were created outside migrations
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'civic_posts'
  ) THEN
    ALTER TABLE public.civic_posts
      ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'questions'
  ) THEN
    ALTER TABLE public.questions
      ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 5. Backfill all existing rows → event 1 ──────────────────
DO $$
DECLARE
  default_event UUID := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  UPDATE public.profiles         SET event_id = default_event WHERE event_id IS NULL;
  UPDATE public.assessments      SET event_id = default_event WHERE event_id IS NULL;
  UPDATE public.polls            SET event_id = default_event WHERE event_id IS NULL;
  UPDATE public.poll_votes       SET event_id = default_event WHERE event_id IS NULL;
  UPDATE public.student_speeches SET event_id = default_event WHERE event_id IS NULL;
  UPDATE public.award_votes      SET event_id = default_event WHERE event_id IS NULL;
  UPDATE public.student_awards   SET event_id = default_event WHERE event_id IS NULL;
  UPDATE public.session_items    SET event_id = default_event WHERE event_id IS NULL;
  UPDATE public.breaking_news    SET event_id = default_event WHERE event_id IS NULL;
  UPDATE public.assessment_locks SET event_id = default_event WHERE event_id IS NULL;
  UPDATE public.system_settings  SET event_id = default_event WHERE event_id IS NULL;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='civic_posts') THEN
    EXECUTE format('UPDATE public.civic_posts SET event_id = %L WHERE event_id IS NULL', default_event);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='questions') THEN
    EXECUTE format('UPDATE public.questions SET event_id = %L WHERE event_id IS NULL', default_event);
  END IF;
END $$;

-- ── 6. Backfill event_participants from existing profiles ─────
INSERT INTO public.event_participants (event_id, user_id, is_current)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  p.user_id,
  true
FROM public.profiles p
WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id)
ON CONFLICT (event_id, user_id) DO NOTHING;

-- ── 7. get_my_event_id() ─────────────────────────────────────
-- Returns the UUID of the caller's currently active event.
CREATE OR REPLACE FUNCTION public.get_my_event_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ep.event_id
  FROM public.event_participants ep
  WHERE ep.user_id = auth.uid()
    AND ep.is_current = true
  ORDER BY ep.joined_at DESC
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_my_event_id() TO authenticated;

-- ── 8. promote_participants() ─────────────────────────────────
-- Organizer calls this to advance selected users to a higher event.
-- Marks their participation in the source event as not current,
-- creates/updates participation in the target event as current.
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

  -- Mark source event participation as no longer current
  UPDATE public.event_participants
  SET is_current = false
  WHERE event_id = p_from_event
    AND user_id = ANY(p_user_ids);

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
END;
$$;
GRANT EXECUTE ON FUNCTION public.promote_participants(UUID[], UUID, UUID) TO authenticated;

-- ── 9. list_events_for_super_admin() ─────────────────────────
-- Returns all events with participant counts. Super admin use only.
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
    COUNT(ep.user_id) AS participant_count,
    e.created_at
  FROM public.events e
  LEFT JOIN public.event_participants ep ON ep.event_id = e.id
  GROUP BY e.id
  ORDER BY e.level DESC, e.created_at DESC
$$;
GRANT EXECUTE ON FUNCTION public.list_events_for_super_admin() TO authenticated;

-- ── 10. get_event_leaderboard(event_id) ──────────────────────
-- Returns ranked students for a given event (used by organizer
-- promotion screen to pick top performers).
CREATE OR REPLACE FUNCTION public.get_event_leaderboard(p_event_id UUID)
RETURNS TABLE (
  user_id         UUID,
  name            TEXT,
  position        TEXT,
  party_number    INT,
  constituency    TEXT,
  state           TEXT,
  serial_number   INT,
  photo_url       TEXT,
  avg_jury_score  NUMERIC,
  preevent_scores NUMERIC,
  final_score     NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.name,
    p.position,
    p.party_number,
    p.constituency,
    p.state,
    p.serial_number,
    p.photo_url,
    ROUND(AVG(a.total_score)::numeric, 2)                             AS avg_jury_score,
    COALESCE(p.preevent_scores, 0)::numeric                           AS preevent_scores,
    ROUND(
      COALESCE(p.preevent_scores, 0) + COALESCE(AVG(a.total_score), 0) * 0.4,
      2
    )                                                                 AS final_score
  FROM public.profiles p
  LEFT JOIN public.assessments a
    ON a.student_id = p.user_id AND a.status = 'submitted' AND a.event_id = p_event_id
  WHERE p.event_id = p_event_id
    AND p.user_type = 'student'
  GROUP BY p.user_id, p.name, p.position, p.party_number, p.constituency,
           p.state, p.serial_number, p.photo_url, p.preevent_scores
  ORDER BY final_score DESC
$$;
GRANT EXECUTE ON FUNCTION public.get_event_leaderboard(UUID) TO authenticated;
