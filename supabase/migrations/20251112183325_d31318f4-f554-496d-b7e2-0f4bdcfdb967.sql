-- Drop and recreate the organizer_leaderboard view to include manual scores
DROP VIEW IF EXISTS public.organizer_leaderboard;

CREATE VIEW public.organizer_leaderboard AS
SELECT 
  p.user_id,
  p.serial_number,
  p.party_number,
  p.preevent_scores,
  -- Check if user has special role (journalist/admin_student)
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = p.user_id 
      AND role IN ('journalist', 'admin_student')
    ) THEN NULL
    ELSE AVG(a.total_score)
  END as jury_average_score,
  -- Jury score converted from 100 to 40 scale
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = p.user_id 
      AND role IN ('journalist', 'admin_student')
    ) THEN NULL
    ELSE (AVG(a.total_score) * 0.4)
  END as jury_converted_score,
  -- Final total score: 
  -- For regular students: preevent_scores (60) + jury_converted_score (40)
  -- For journalists/admin: organizer_manual_score (100)
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = p.user_id 
      AND role IN ('journalist', 'admin_student')
    ) THEN p.organizer_manual_score
    ELSE COALESCE(p.preevent_scores, 0) + COALESCE((AVG(a.total_score) * 0.4), 0)
  END as final_total_score,
  COUNT(a.id) as assessment_count,
  ARRAY_AGG(DISTINCT sa.award_id) FILTER (WHERE sa.award_id IS NOT NULL) as award_ids,
  p.name,
  p.position,
  p.party_name,
  p.constituency,
  p.state,
  p.city,
  p.photo_url
FROM public.profiles p
LEFT JOIN public.assessments a ON p.user_id = a.student_id AND a.status = 'submitted'
LEFT JOIN public.student_awards sa ON p.user_id = sa.student_id
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
ORDER BY final_total_score DESC NULLS LAST, p.serial_number ASC;