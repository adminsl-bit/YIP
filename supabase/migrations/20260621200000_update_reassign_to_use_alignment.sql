-- Update reassign_event_committees_parties to read alignment from event_parties
-- instead of using the old threshold formula. Party and committee assignment
-- now flow through the same path, consistent with how party names work.
CREATE OR REPLACE FUNCTION public.reassign_event_committees_parties(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_committee_count  INT;
  v_party_count      INT;
BEGIN
  SELECT COUNT(*) INTO v_committee_count FROM event_committees WHERE event_id = p_event_id;
  SELECT COUNT(*) INTO v_party_count     FROM event_parties    WHERE event_id = p_event_id;

  -- Build an ordered list of eligible students (excludes Admin/Journalist)
  -- with a 0-based sequential index matching the bulk import ordering.
  CREATE TEMP TABLE _reassign_students ON COMMIT DROP AS
    SELECT
      user_id,
      (ROW_NUMBER() OVER (ORDER BY serial_number) - 1) AS seq
    FROM profiles
    WHERE event_id   = p_event_id
      AND user_type  = 'student'
      AND is_active  = true
      AND position NOT IN ('Admin Student', 'Journalist');

  -- Reassign committees (round-robin by seq % committee_count)
  IF v_committee_count > 0 THEN
    UPDATE profiles p
    SET committee = ec.name
    FROM _reassign_students s
    JOIN (
      SELECT name, (ROW_NUMBER() OVER (ORDER BY display_order) - 1) AS idx
      FROM event_committees
      WHERE event_id = p_event_id
    ) ec ON s.seq % v_committee_count = ec.idx
    WHERE p.user_id = s.user_id;
  END IF;

  -- Reassign parties (round-robin by seq % party_count)
  -- Uses alignment column set by SuperAdmin — NOT a threshold formula.
  IF v_party_count > 0 THEN
    UPDATE profiles p
    SET
      party_name      = ep.name,
      party_number    = ep.idx + 1,
      party_alignment = ep.alignment
    FROM _reassign_students s
    JOIN (
      SELECT
        name,
        alignment,
        (ROW_NUMBER() OVER (ORDER BY display_order) - 1) AS idx
      FROM event_parties
      WHERE event_id = p_event_id
    ) ep ON s.seq % v_party_count = ep.idx
    WHERE p.user_id = s.user_id;
  END IF;
END;
$$;
