-- Manual Scoring page: include all students, not just journalists/admin-students
--
-- Pre-event scores now feed into the flexible scoring weightage for every
-- student (see 20260616000000_flexible_scoring_weightage.sql), so organizers
-- need to view/edit pre-event scores for the whole roster from the Manual
-- Scoring page, not just journalists/admin-students. Live event scores
-- (organizer_manual_score, out of 40) remain a journalist/admin-student
-- concept and are only surfaced for those roles in the UI.

-- CREATE OR REPLACE VIEW can't reorder/rename existing columns (the new
-- preevent_scores column shifts special_role's position), so drop first.
DROP VIEW IF EXISTS public.organizer_manual_scoring;

CREATE VIEW public.organizer_manual_scoring AS
SELECT
  p.user_id,
  p.serial_number,
  p.name,
  p.position,
  p.party_number,
  p.party_name,
  p.photo_url,
  p.user_type,
  p.organizer_manual_score,
  p.preevent_scores,
  CASE
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = p.user_id AND role = 'journalist') THEN 'journalist'
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = p.user_id AND role = 'admin_student') THEN 'admin_student'
    ELSE NULL
  END as special_role
FROM public.profiles p
WHERE p.user_type = 'student'
ORDER BY p.serial_number;

ALTER VIEW public.organizer_manual_scoring SET (security_invoker = true);
GRANT SELECT ON public.organizer_manual_scoring TO authenticated;
