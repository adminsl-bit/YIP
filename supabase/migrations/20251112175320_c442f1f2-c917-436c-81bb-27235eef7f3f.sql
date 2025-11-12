-- Drop existing organizer leaderboard view if it exists
DROP VIEW IF EXISTS public.organizer_leaderboard CASCADE;

-- Create organizer leaderboard view with converted scores and final totals
CREATE VIEW public.organizer_leaderboard AS
SELECT 
  p.user_id,
  p.serial_number,
  p.name,
  p.position,
  p.party_number,
  p.party_name,
  p.constituency,
  p.state,
  p.city,
  p.photo_url,
  p.preevent_scores,
  -- Calculate average jury score (out of 100)
  ROUND(AVG(a.total_score), 2) as jury_average_score,
  -- Calculate converted jury score (out of 40)
  ROUND((AVG(a.total_score) / 100.0) * 40, 2) as jury_converted_score,
  -- Calculate final total score (pre-event 60 + converted jury 40)
  ROUND(COALESCE(p.preevent_scores, 0) + COALESCE((AVG(a.total_score) / 100.0) * 40, 0), 2) as final_total_score,
  -- Count of assessments
  COUNT(a.id) as assessment_count,
  -- Award IDs
  ARRAY_AGG(DISTINCT sa.award_id) FILTER (WHERE sa.award_id IS NOT NULL) as award_ids
FROM public.profiles p
LEFT JOIN public.assessments a ON p.user_id = a.student_id AND a.status = 'submitted'
LEFT JOIN public.student_awards sa ON p.user_id = sa.student_id
WHERE p.user_type = 'student' AND p.is_active = true
GROUP BY p.user_id, p.serial_number, p.name, p.position, p.party_number, p.party_name, 
         p.constituency, p.state, p.city, p.photo_url, p.preevent_scores
ORDER BY final_total_score DESC NULLS LAST, p.serial_number ASC;