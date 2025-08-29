-- Fix security definer view by removing it and creating regular view
DROP VIEW IF EXISTS public.jury_leaderboard;

-- Create a regular view instead of security definer
CREATE VIEW public.jury_leaderboard AS
SELECT 
  p.user_id,
  p.name,
  p.position,
  p.party_number,
  p.constituency,
  p.state,
  p.city,
  p.photo_url,
  COALESCE(AVG(a.total_score), 0) as average_score,
  COUNT(a.id) as assessment_count,
  ARRAY_AGG(DISTINCT sa.award_id) FILTER (WHERE sa.award_id IS NOT NULL) as award_ids
FROM public.profiles p
LEFT JOIN public.assessments a ON p.user_id = a.student_id AND a.status = 'submitted'
LEFT JOIN public.student_awards sa ON p.user_id = sa.student_id
WHERE p.user_type = 'student'
GROUP BY p.user_id, p.name, p.position, p.party_number, p.constituency, p.state, p.city, p.photo_url
ORDER BY average_score DESC;

-- Fix search path for functions
ALTER FUNCTION public.check_award_consensus(uuid, uuid) SET search_path = 'public';
ALTER FUNCTION public.assign_award_on_consensus() SET search_path = 'public';