-- Fix Security Definer View issue by converting views to SECURITY INVOKER
-- This ensures views respect RLS policies of the querying user, not the view creator

-- Drop existing views
DROP VIEW IF EXISTS public.jury_leaderboard CASCADE;
DROP VIEW IF EXISTS public.public_polls CASCADE;
DROP VIEW IF EXISTS public.public_poll_votes CASCADE;

-- Recreate jury_leaderboard view with SECURITY INVOKER
CREATE VIEW public.jury_leaderboard
WITH (security_invoker = true)
AS
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
GROUP BY p.user_id, p.name, p.position, p.party_number, p.constituency, p.state, p.city, p.photo_url
ORDER BY COALESCE(AVG(a.total_score), 0) DESC;

-- Recreate public_polls view with SECURITY INVOKER
CREATE VIEW public.public_polls
WITH (security_invoker = true)
AS
SELECT 
  id,
  title,
  description,
  options,
  is_active,
  show_results_publicly,
  show_post_analysis,
  created_at,
  updated_at
FROM polls
WHERE is_active = true OR show_post_analysis = true;

-- Recreate public_poll_votes view with SECURITY INVOKER
CREATE VIEW public.public_poll_votes
WITH (security_invoker = true)
AS
SELECT 
  poll_id,
  option_id
FROM poll_votes pv
WHERE EXISTS (
  SELECT 1
  FROM polls p
  WHERE p.id = pv.poll_id 
    AND (p.is_active = true OR p.show_post_analysis = true)
);