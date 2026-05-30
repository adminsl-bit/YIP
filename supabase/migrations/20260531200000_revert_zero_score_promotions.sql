-- Revert promotions for students who have no score (final_score = 0 or null).
-- This undoes promote_participants: restores profiles.event_id to the source event,
-- removes the destination event_participants row, and restores the source row.
--
-- Run in Supabase SQL editor. Preview with the SELECT first, then run the UPDATE/DELETE.

-- 1. Preview: which promotions will be reverted?
SELECT
  p.name,
  p.user_id,
  ep_dest.promoted_from_event_id  AS source_event_id,
  ev_src.name                     AS source_event_name,
  ep_dest.event_id                AS dest_event_id,
  ev_dest.name                    AS dest_event_name
FROM event_participants ep_dest
JOIN profiles          p       ON p.user_id      = ep_dest.user_id
JOIN events            ev_src  ON ev_src.id       = ep_dest.promoted_from_event_id
JOIN events            ev_dest ON ev_dest.id      = ep_dest.event_id
WHERE ep_dest.is_current              = true
  AND ep_dest.promoted_from_event_id IS NOT NULL
  AND (p.preevent_scores IS NULL OR p.preevent_scores < 0.01)
  -- also check organizer_manual_score and jury scores are all zero/null
  AND NOT EXISTS (
    SELECT 1 FROM assessments a
    WHERE a.student_id = p.user_id AND a.status = 'submitted'
  );

-- 2. Restore profiles.event_id to the source event
UPDATE profiles p
SET event_id = ep_dest.promoted_from_event_id
FROM event_participants ep_dest
WHERE ep_dest.user_id              = p.user_id
  AND ep_dest.is_current           = true
  AND ep_dest.promoted_from_event_id IS NOT NULL
  AND (p.preevent_scores IS NULL OR p.preevent_scores < 0.01)
  AND NOT EXISTS (
    SELECT 1 FROM assessments a
    WHERE a.student_id = p.user_id AND a.status = 'submitted'
  );

-- 3. Restore source event_participants row (mark as current again)
UPDATE event_participants ep_src
SET is_current  = true,
    promoted_at = NULL
FROM event_participants ep_dest
WHERE ep_src.user_id  = ep_dest.user_id
  AND ep_src.event_id = ep_dest.promoted_from_event_id
  AND ep_dest.is_current              = true
  AND ep_dest.promoted_from_event_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM assessments a
    WHERE a.student_id = ep_dest.user_id AND a.status = 'submitted'
  );

-- 4. Remove the destination event_participants row
DELETE FROM event_participants ep_dest
USING profiles p
WHERE ep_dest.user_id              = p.user_id
  AND ep_dest.is_current           = true
  AND ep_dest.promoted_from_event_id IS NOT NULL
  AND (p.preevent_scores IS NULL OR p.preevent_scores < 0.01)
  AND NOT EXISTS (
    SELECT 1 FROM assessments a
    WHERE a.student_id = p.user_id AND a.status = 'submitted'
  );
