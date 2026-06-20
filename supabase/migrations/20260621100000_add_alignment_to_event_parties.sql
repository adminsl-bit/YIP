-- Allow superadmin to explicitly mark each party as ruling or opposition,
-- overriding the automatic threshold-based assignment.
ALTER TABLE public.event_parties
  ADD COLUMN IF NOT EXISTS alignment TEXT NOT NULL DEFAULT 'opposition'
    CHECK (alignment IN ('ruling_party', 'opposition'));

-- Backfill existing parties: first half (by display_order) = ruling, rest = opposition.
-- This matches the previous automatic behaviour so existing events aren't disrupted.
UPDATE public.event_parties ep
SET alignment = CASE
  WHEN ep.display_order < (
    SELECT FLOOR(COUNT(*) / 2.0) + 1
    FROM public.event_parties ep2
    WHERE ep2.event_id = ep.event_id
  ) THEN 'ruling_party'
  ELSE 'opposition'
END;
