-- Parliamentary Motions
--
-- Lets students raise formal parliamentary motions (Adjournment Motion,
-- Calling Attention Notice, etc.) with a subject and supporting details.
-- Organizers/admin-students can raise motions on behalf of any student and
-- update the Status/Outcome of any motion. Everyone in an event shares one
-- motions log/table.

DO $$ BEGIN
  CREATE TYPE motion_type AS ENUM (
    'adjournment_motion',
    'calling_attention_notice',
    'breach_of_privilege',
    'no_confidence_motion',
    'short_duration_discussion',
    'obituary_reference',
    'laying_of_papers'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE motion_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'discussed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.motions (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id    UUID REFERENCES public.events(id) ON DELETE CASCADE,
  motion_type motion_type NOT NULL,
  subject     TEXT NOT NULL,
  details     TEXT,
  raised_by   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      motion_status NOT NULL DEFAULT 'pending',
  outcome     TEXT,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_motions_event ON public.motions(event_id);

DROP TRIGGER IF EXISTS update_motions_updated_at ON public.motions;
CREATE TRIGGER update_motions_updated_at
  BEFORE UPDATE ON public.motions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ── Moderator helper ─────────────────────────────────────────
-- True if the caller is an organizer/jury, or has the admin_student role,
-- for the same event as target_event (treating NULL event_id as a match).
CREATE OR REPLACE FUNCTION public.is_event_moderator(target_event UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (p.event_id = target_event OR (p.event_id IS NULL AND target_event IS NULL))
      AND (
        p.user_type IN ('organizer', 'jury')
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'admin_student'
        )
      )
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_event_moderator(UUID) TO authenticated;

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.motions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View motions in own event" ON public.motions;
CREATE POLICY "View motions in own event"
  ON public.motions FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND (p.event_id = motions.event_id OR (p.event_id IS NULL AND motions.event_id IS NULL))
    )
  );

DROP POLICY IF EXISTS "Raise motions for self or as moderator" ON public.motions;
CREATE POLICY "Raise motions for self or as moderator"
  ON public.motions FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (raised_by = auth.uid() OR public.is_event_moderator(event_id))
  );

DROP POLICY IF EXISTS "Moderators update motion status and outcome" ON public.motions;
CREATE POLICY "Moderators update motion status and outcome"
  ON public.motions FOR UPDATE
  TO authenticated
  USING (public.is_super_admin() OR public.is_event_moderator(event_id));

DROP POLICY IF EXISTS "Retract own pending motion or moderate" ON public.motions;
CREATE POLICY "Retract own pending motion or moderate"
  ON public.motions FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_event_moderator(event_id)
    OR (raised_by = auth.uid() AND status = 'pending')
  );

-- ── Realtime ─────────────────────────────────────────────────
ALTER TABLE public.motions REPLICA IDENTITY FULL;

-- ALTER PUBLICATION can deadlock against Supabase's realtime replication
-- worker, which concurrently reads the publication. Retry a few times.
DO $$
DECLARE
  attempt INT := 0;
BEGIN
  LOOP
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'motions'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.motions;
      END IF;
      EXIT;
    EXCEPTION WHEN deadlock_detected OR lock_not_available THEN
      attempt := attempt + 1;
      IF attempt >= 5 THEN
        RAISE;
      END IF;
      PERFORM pg_sleep(1);
    END;
  END LOOP;
END $$;
