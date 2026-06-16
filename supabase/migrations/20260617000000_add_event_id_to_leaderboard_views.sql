-- Add event_id to organizer_leaderboard and jury_leaderboard views
-- so organizers/jury can filter results by their own event.

-- jury_leaderboard
DROP VIEW IF EXISTS public.jury_leaderboard;

CREATE VIEW public.jury_leaderboard AS
SELECT
  p.user_id,
  p.event_id,
  p.name,
  p.position,
  p.party_number,
  p.constituency,
  p.state,
  p.city,
  p.photo_url,
  COALESCE(AVG(a.total_score), 0) AS average_score,
  COUNT(a.id) AS assessment_count,
  COUNT(DISTINCT a.jury_id) FILTER (WHERE a.status = 'submitted') AS jury_count_submitted,
  ARRAY_AGG(DISTINCT sa.award_id) FILTER (WHERE sa.award_id IS NOT NULL) AS award_ids
FROM profiles p
LEFT JOIN assessments a ON p.user_id = a.student_id AND a.status = 'submitted'
LEFT JOIN student_awards sa ON p.user_id = sa.student_id
WHERE p.user_type = 'student'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = p.user_id
      AND user_roles.role IN ('admin_student', 'journalist')
  )
GROUP BY
  p.user_id,
  p.event_id,
  p.name,
  p.position,
  p.party_number,
  p.constituency,
  p.state,
  p.city,
  p.photo_url
ORDER BY COALESCE(AVG(a.total_score), 0) DESC;

DROP VIEW IF EXISTS public.organizer_leaderboard;

CREATE VIEW public.organizer_leaderboard AS
SELECT
  p.user_id,
  p.event_id,
  p.serial_number,
  p.party_number,
  p.preevent_scores,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = p.user_id
        AND user_roles.role IN ('journalist', 'admin_student')
    ) THEN NULL
    ELSE AVG(a.total_score)
  END AS jury_average_score,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = p.user_id
        AND user_roles.role IN ('journalist', 'admin_student')
    ) THEN NULL
    ELSE AVG(a.total_score) * 0.4
  END AS jury_converted_score,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = p.user_id
        AND user_roles.role IN ('journalist', 'admin_student')
    ) THEN COALESCE(p.preevent_scores, 0) + COALESCE(p.organizer_manual_score, 0)
    ELSE COALESCE(p.preevent_scores, 0) + COALESCE(AVG(a.total_score) * 0.4, 0)
  END AS final_total_score,
  COUNT(a.id) AS assessment_count,
  COUNT(DISTINCT a.jury_id) FILTER (WHERE a.status = 'submitted') AS jury_count_submitted,
  ARRAY_AGG(DISTINCT sa.award_id) FILTER (WHERE sa.award_id IS NOT NULL) AS award_ids,
  p.name,
  p.position,
  p.party_name,
  p.constituency,
  p.state,
  p.city,
  p.photo_url
FROM profiles p
LEFT JOIN assessments a ON p.user_id = a.student_id AND a.status = 'submitted'
LEFT JOIN student_awards sa ON p.user_id = sa.student_id
WHERE p.user_type = 'student' AND p.is_active = true
GROUP BY
  p.user_id,
  p.event_id,
  p.serial_number,
  p.party_number,
  p.preevent_scores,
  p.organizer_manual_score,
  p.name,
  p.position,
  p.party_name,
  p.constituency,
  p.state,
  p.city,
  p.photo_url
ORDER BY
  (CASE
    WHEN EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = p.user_id
        AND user_roles.role IN ('journalist', 'admin_student')
    ) THEN COALESCE(p.preevent_scores, 0) + COALESCE(p.organizer_manual_score, 0)
    ELSE COALESCE(p.preevent_scores, 0) + COALESCE(AVG(a.total_score) * 0.4, 0)
  END) DESC NULLS LAST,
  p.serial_number;
