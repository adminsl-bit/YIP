-- Zone managers: stores the Regional Manager (RM) name shown on each
-- zone card in the Super Admin "Zones" dashboard. zone_id matches the
-- ZoneId values defined in src/lib/regions.ts.
CREATE TABLE IF NOT EXISTS public.zone_managers (
  zone_id    TEXT PRIMARY KEY,
  rm_name    TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.zone_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage zone managers"
  ON public.zone_managers FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
