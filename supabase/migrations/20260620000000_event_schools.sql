-- Event-scoped school list. Organizers (for their own event) and super admins
-- can manage the schools that show up in the student onboarding dropdown.
-- Students record their chosen school on their profile.

CREATE TABLE IF NOT EXISTS public.event_schools (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id      UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  display_order INT  NOT NULL DEFAULT 0,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_schools_event_id ON public.event_schools(event_id, display_order);

ALTER TABLE public.event_schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users view event schools" ON public.event_schools;
CREATE POLICY "Authenticated users view event schools"
  ON public.event_schools FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Organizers and super admins manage event schools" ON public.event_schools;
CREATE POLICY "Organizers and super admins manage event schools"
  ON public.event_schools FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.user_type = 'organizer'
        AND p.event_id = event_schools.event_id
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.user_type = 'organizer'
        AND p.event_id = event_schools.event_id
    )
  );

-- Students record which school they belong to during onboarding.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school TEXT;

-- ── Realtime ─────────────────────────────────────────────────
ALTER TABLE public.event_schools REPLICA IDENTITY FULL;

DO $$
DECLARE
  attempt INT := 0;
BEGIN
  LOOP
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'event_schools'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.event_schools;
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
