-- Drop and recreate organizer_leaderboard view with jury participation tracking
-- This view tracks actual jury assessments submitted for better transparency
DROP VIEW IF EXISTS organizer_leaderboard;

CREATE VIEW organizer_leaderboard AS
SELECT 
  p.user_id,
  p.serial_number,
  p.party_number,
  p.preevent_scores,
  -- Jury average score: Average of all submitted assessments across ALL sessions (out of 100)
  -- NULL for special roles (journalist/admin_student)
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = p.user_id 
      AND user_roles.role IN ('journalist', 'admin_student')
    ) THEN NULL
    ELSE AVG(a.total_score)
  END AS jury_average_score,
  -- Jury converted score: Average score converted to 40-point scale
  -- Formula: (average of all session scores) * 0.4 = out of 40
  -- NULL for special roles (journalist/admin_student)
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = p.user_id 
      AND user_roles.role IN ('journalist', 'admin_student')
    ) THEN NULL
    ELSE AVG(a.total_score) * 0.4
  END AS jury_converted_score,
  -- Final total score calculation:
  -- For admin/journalist: preevent_scores + organizer_manual_score
  -- For regular students: preevent_scores + (average of all session jury scores converted to 40)
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = p.user_id 
      AND user_roles.role IN ('journalist', 'admin_student')
    ) THEN COALESCE(p.preevent_scores, 0) + COALESCE(p.organizer_manual_score, 0)
    ELSE COALESCE(p.preevent_scores, 0) + COALESCE(AVG(a.total_score) * 0.4, 0)
  END AS final_total_score,
  -- Count of all submitted assessments (across all sessions and juries)
  COUNT(a.id) AS assessment_count,
  -- Count of unique juries who have submitted assessments for this student
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