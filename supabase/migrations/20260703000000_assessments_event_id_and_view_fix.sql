-- assessments.event_id was missing — the organizer_leaderboard view referenced it,
-- causing "column a.event_id does not exist" every time the leaderboard was queried.
-- Also update the view to include 'draft' assessments so locked-session scores
-- (which stay draft until the jury clicks Submit) appear on the leaderboard.

-- Step 1: add event_id column to assessments
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

-- Step 2: back-fill existing assessments from the student's profile event
UPDATE public.assessments a
SET event_id = p.event_id
FROM public.profiles p
WHERE a.student_id = p.user_id
  AND a.event_id IS NULL;

-- Step 3: rebuild organizer_leaderboard to use the now-existing column
--         and to count both submitted AND draft (locked-session) assessments
DROP VIEW IF EXISTS public.organizer_leaderboard;

CREATE VIEW public.organizer_leaderboard AS

-- Part 1: students currently assigned to this event
SELECT
  p.event_id,
  true                AS is_current,
  NULL::timestamptz   AS promoted_at,
  p.user_id,
  p.serial_number,
  p.party_number,
  p.preevent_scores,
  CASE WHEN EXISTS (
    SELECT 1 FROM user_roles WHERE user_roles.user_id = p.user_id
      AND user_roles.role IN ('journalist', 'admin_student')
  ) THEN NULL ELSE AVG(a.total_score) END AS jury_average_score,
  CASE WHEN EXISTS (
    SELECT 1 FROM user_roles WHERE user_roles.user_id = p.user_id
      AND user_roles.role IN ('journalist', 'admin_student')
  ) THEN NULL ELSE AVG(a.total_score) * 0.4 END AS jury_converted_score,
  CASE WHEN EXISTS (
    SELECT 1 FROM user_roles WHERE user_roles.user_id = p.user_id
      AND user_roles.role IN ('journalist', 'admin_student')
  ) THEN COALESCE(p.preevent_scores, 0) + COALESCE(p.organizer_manual_score, 0)
    ELSE COALESCE(p.preevent_scores, 0) + COALESCE(AVG(a.total_score) * 0.4, 0)
  END AS final_total_score,
  COUNT(a.id)                                                            AS assessment_count,
  COUNT(DISTINCT a.jury_id) FILTER (WHERE a.status = 'submitted')       AS jury_count_submitted,
  ARRAY_AGG(DISTINCT sa.award_id) FILTER (WHERE sa.award_id IS NOT NULL) AS award_ids,
  p.name,
  p.position,
  p.party_name,
  p.constituency,
  p.state,
  p.city,
  p.photo_url
FROM profiles p
LEFT JOIN assessments a
  ON p.user_id = a.student_id
  AND a.status IN ('submitted', 'draft')   -- include locked-session drafts
  AND a.event_id = p.event_id
  AND a.session_id IS NULL                 -- one row per jury×student (no per-session rows)
LEFT JOIN student_awards sa ON p.user_id = sa.student_id
WHERE p.user_type = 'student' AND p.is_active = true
GROUP BY
  p.event_id, p.user_id, p.serial_number, p.party_number, p.preevent_scores,
  p.organizer_manual_score, p.name, p.position, p.party_name,
  p.constituency, p.state, p.city, p.photo_url

UNION ALL

-- Part 2: students promoted out (historical view)
SELECT
  ep.event_id,
  false               AS is_current,
  ep.promoted_at,
  p.user_id,
  p.serial_number,
  p.party_number,
  p.preevent_scores,
  CASE WHEN EXISTS (
    SELECT 1 FROM user_roles WHERE user_roles.user_id = p.user_id
      AND user_roles.role IN ('journalist', 'admin_student')
  ) THEN NULL ELSE AVG(a.total_score) END AS jury_average_score,
  CASE WHEN EXISTS (
    SELECT 1 FROM user_roles WHERE user_roles.user_id = p.user_id
      AND user_roles.role IN ('journalist', 'admin_student')
  ) THEN NULL ELSE AVG(a.total_score) * 0.4 END AS jury_converted_score,
  CASE WHEN EXISTS (
    SELECT 1 FROM user_roles WHERE user_roles.user_id = p.user_id
      AND user_roles.role IN ('journalist', 'admin_student')
  ) THEN COALESCE(p.preevent_scores, 0) + COALESCE(p.organizer_manual_score, 0)
    ELSE COALESCE(p.preevent_scores, 0) + COALESCE(AVG(a.total_score) * 0.4, 0)
  END AS final_total_score,
  COUNT(a.id)                                                            AS assessment_count,
  COUNT(DISTINCT a.jury_id) FILTER (WHERE a.status = 'submitted')       AS jury_count_submitted,
  ARRAY_AGG(DISTINCT sa.award_id) FILTER (WHERE sa.award_id IS NOT NULL) AS award_ids,
  p.name,
  p.position,
  p.party_name,
  p.constituency,
  p.state,
  p.city,
  p.photo_url
FROM event_participants ep
JOIN profiles p ON p.user_id = ep.user_id
LEFT JOIN assessments a
  ON p.user_id = a.student_id
  AND a.status IN ('submitted', 'draft')
  AND a.event_id = ep.event_id
  AND a.session_id IS NULL
LEFT JOIN student_awards sa ON p.user_id = sa.student_id
WHERE p.user_type = 'student' AND p.is_active = true
  AND ep.is_current = false AND ep.promoted_at IS NOT NULL
GROUP BY
  ep.event_id, ep.promoted_at, p.user_id, p.serial_number, p.party_number,
  p.preevent_scores, p.organizer_manual_score, p.name, p.position, p.party_name,
  p.constituency, p.state, p.city, p.photo_url;
