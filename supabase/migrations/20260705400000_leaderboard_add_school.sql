-- Add school column to organizer_leaderboard view (was missing, showed — in UI)
DROP VIEW IF EXISTS public.organizer_leaderboard;

CREATE VIEW public.organizer_leaderboard AS
SELECT
  p.event_id, true AS is_current, NULL::timestamptz AS promoted_at,
  p.user_id, p.serial_number, p.party_number, p.preevent_scores,
  CASE WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = p.user_id AND user_roles.role IN ('journalist','admin_student')) THEN NULL ELSE AVG(a.total_score) END AS jury_average_score,
  CASE WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = p.user_id AND user_roles.role IN ('journalist','admin_student')) THEN NULL ELSE AVG(a.total_score)*0.4 END AS jury_converted_score,
  CASE WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = p.user_id AND user_roles.role IN ('journalist','admin_student')) THEN COALESCE(p.preevent_scores,0)+COALESCE(p.organizer_manual_score,0) ELSE COALESCE(p.preevent_scores,0)+COALESCE(AVG(a.total_score)*0.4,0) END AS final_total_score,
  COUNT(a.id) AS assessment_count,
  COUNT(DISTINCT a.jury_id) FILTER (WHERE a.status='submitted') AS jury_count_submitted,
  ARRAY_AGG(DISTINCT sa.award_id) FILTER (WHERE sa.award_id IS NOT NULL) AS award_ids,
  p.name, p.position, p.party_name, p.constituency, p.state, p.city, p.school, p.photo_url
FROM profiles p
LEFT JOIN assessments a ON p.user_id=a.student_id AND a.status IN ('submitted','draft') AND a.event_id=p.event_id AND a.session_id IS NULL
LEFT JOIN student_awards sa ON p.user_id=sa.student_id
WHERE p.user_type='student' AND p.is_active=true
GROUP BY p.event_id,p.user_id,p.serial_number,p.party_number,p.preevent_scores,p.organizer_manual_score,p.name,p.position,p.party_name,p.constituency,p.state,p.city,p.school,p.photo_url
UNION ALL
SELECT
  ep.event_id, false AS is_current, ep.promoted_at,
  p.user_id, p.serial_number, p.party_number, p.preevent_scores,
  CASE WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id=p.user_id AND user_roles.role IN ('journalist','admin_student')) THEN NULL ELSE AVG(a.total_score) END AS jury_average_score,
  CASE WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id=p.user_id AND user_roles.role IN ('journalist','admin_student')) THEN NULL ELSE AVG(a.total_score)*0.4 END AS jury_converted_score,
  CASE WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id=p.user_id AND user_roles.role IN ('journalist','admin_student')) THEN COALESCE(p.preevent_scores,0)+COALESCE(p.organizer_manual_score,0) ELSE COALESCE(p.preevent_scores,0)+COALESCE(AVG(a.total_score)*0.4,0) END AS final_total_score,
  COUNT(a.id) AS assessment_count,
  COUNT(DISTINCT a.jury_id) FILTER (WHERE a.status='submitted') AS jury_count_submitted,
  ARRAY_AGG(DISTINCT sa.award_id) FILTER (WHERE sa.award_id IS NOT NULL) AS award_ids,
  p.name, p.position, p.party_name, p.constituency, p.state, p.city, p.school, p.photo_url
FROM event_participants ep
JOIN profiles p ON p.user_id=ep.user_id
LEFT JOIN assessments a ON p.user_id=a.student_id AND a.status IN ('submitted','draft') AND a.event_id=ep.event_id AND a.session_id IS NULL
LEFT JOIN student_awards sa ON p.user_id=sa.student_id
WHERE p.user_type='student' AND p.is_active=true AND ep.is_current=false AND ep.promoted_at IS NOT NULL
GROUP BY ep.event_id,ep.promoted_at,p.user_id,p.serial_number,p.party_number,p.preevent_scores,p.organizer_manual_score,p.name,p.position,p.party_name,p.constituency,p.state,p.city,p.school,p.photo_url;
