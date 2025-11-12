-- Update jury_leaderboard view to exclude admin and journalist students
DROP VIEW IF EXISTS jury_leaderboard;

CREATE VIEW jury_leaderboard AS
SELECT 
  p.user_id,
  p.name,
  p.position,
  p.party_number,
  p.constituency,
  p.state,
  p.city,
  p.photo_url,
  COALESCE(AVG(a.total_score), 0) AS average_score,
  COUNT(a.id) AS assessment_count,
  ARRAY_AGG(DISTINCT sa.award_id) FILTER (WHERE sa.award_id IS NOT NULL) AS award_ids
FROM profiles p
LEFT JOIN assessments a ON p.user_id = a.student_id AND a.status = 'submitted'
LEFT JOIN student_awards sa ON p.user_id = sa.student_id
WHERE p.user_type = 'student'
  -- Exclude students with admin_student or journalist roles
  AND NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = p.user_id 
    AND user_roles.role IN ('admin_student', 'journalist')
  )
GROUP BY 
  p.user_id, 
  p.name, 
  p.position, 
  p.party_number, 
  p.constituency, 
  p.state, 
  p.city, 
  p.photo_url
ORDER BY COALESCE(AVG(a.total_score), 0) DESC;