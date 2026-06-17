-- Add event_id to tables that were missing it, and update
-- organizer_manual_scoring view to expose event_id so the
-- ManualScoring page can filter to the organizer's own event.

ALTER TABLE public.timer_sessions
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

ALTER TABLE public.voting_sessions
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

-- organizer_manual_scoring: add event_id to the view so clients can filter
DROP VIEW IF EXISTS public.organizer_manual_scoring;

CREATE VIEW public.organizer_manual_scoring AS
SELECT
  p.user_id,
  p.event_id,
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
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = p.user_id AND role = 'journalist')    THEN 'journalist'
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = p.user_id AND role = 'admin_student') THEN 'admin_student'
    ELSE NULL
  END AS special_role
FROM public.profiles p
WHERE p.user_type = 'student'
ORDER BY p.serial_number;

ALTER VIEW public.organizer_manual_scoring SET (security_invoker = true);
GRANT SELECT ON public.organizer_manual_scoring TO authenticated;

-- admin_student_dashboard: add event_id so the speech-tracker hook can
-- filter by the caller's event and avoid cross-event data leakage.
DROP VIEW IF EXISTS public.admin_student_dashboard;

CREATE VIEW public.admin_student_dashboard AS
SELECT
  p.user_id,
  p.event_id,
  p.serial_number,
  p.name,
  p.position,
  p.party_number,
  p.party_name,
  p.constituency,
  p.state,
  p.city,
  p.photo_url,
  p.is_active,
  COALESCE(COUNT(DISTINCT ss.id), 0)::INTEGER AS speech_count,
  MAX(ss.recorded_at) AS last_speech_at,
  EXISTS (
    SELECT 1 FROM public.assessments a WHERE a.student_id = p.user_id
  ) AS has_jury_score,
  COALESCE(
    (SELECT COUNT(*) FROM public.assessments a WHERE a.student_id = p.user_id),
    0
  )::INTEGER AS assessment_count,
  COALESCE(
    (SELECT AVG(total_score) FROM public.assessments a WHERE a.student_id = p.user_id),
    0
  )::NUMERIC AS average_score
FROM public.profiles p
LEFT JOIN public.student_speeches ss ON ss.student_id = p.user_id
WHERE p.user_type = 'student' AND p.is_active = true
GROUP BY p.user_id, p.event_id, p.serial_number, p.name, p.position,
         p.party_number, p.party_name, p.constituency, p.state, p.city,
         p.photo_url, p.is_active;

GRANT SELECT ON public.admin_student_dashboard TO authenticated;
