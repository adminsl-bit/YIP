-- Impact Story settings
--
-- Single-row table holding the editable parts of the Super Admin "Impact
-- Story" page: hero photo, testimonial quote, and the "Then vs Now" growth
-- baseline. Everything else on that page is computed live from existing
-- tables (events, profiles, motions, event_schools, session_items).

CREATE TABLE IF NOT EXISTS public.impact_story_settings (
  id                INT  NOT NULL DEFAULT 1 PRIMARY KEY CHECK (id = 1),
  hero_photo_url    TEXT,
  quote_text        TEXT,
  quote_author      TEXT,
  baseline_year     INT  NOT NULL DEFAULT 2014,
  baseline_hubs     INT  NOT NULL DEFAULT 12,
  baseline_students INT  NOT NULL DEFAULT 500,
  updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

INSERT INTO public.impact_story_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.impact_story_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage impact story settings" ON public.impact_story_settings;
CREATE POLICY "Super admins manage impact story settings"
  ON public.impact_story_settings FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ── Storage bucket for the impact story hero photo ────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('impact-story', 'impact-story', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read access for impact story media" ON storage.objects;
CREATE POLICY "Public read access for impact story media"
ON storage.objects FOR SELECT
USING (bucket_id = 'impact-story');

DROP POLICY IF EXISTS "Super admins manage impact story media" ON storage.objects;
CREATE POLICY "Super admins manage impact story media"
ON storage.objects FOR ALL
USING (bucket_id = 'impact-story' AND public.is_super_admin())
WITH CHECK (bucket_id = 'impact-story' AND public.is_super_admin());
