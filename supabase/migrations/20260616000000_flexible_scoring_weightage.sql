-- Flexible pre-event vs judge/live score weighting
--
-- Lets organizers control whether the pre-event score counts toward the
-- final leaderboard total, and if so with what weight vs. judge/live
-- scoring (e.g. 50/50, 60/40, or 100% judge when disabled).
--
-- Both branches below normalize each component to a 0-100 scale before
-- weighting:
--   preevent_normalized = preevent_scores * (100/60)        -- 0-60 -> 0-100
--   judge_normalized    = AVG(assessments.total_score)      -- already 0-100, for students
--                       or organizer_manual_score * (100/40) -- 0-40 -> 0-100, for journalist/admin_student
--   final = enabled ? preevent_normalized * (pct/100) + judge_normalized * ((100-pct)/100)
--                   : judge_normalized
--
-- At the seeded defaults (enabled=true, pct=60) this reproduces today's
-- hardcoded formula exactly:
--   preevent_normalized * 0.6 = preevent_scores
--   judge_normalized * 0.4    = AVG(total_score) * 0.4 / organizer_manual_score

INSERT INTO public.system_settings (setting_key, setting_value, description, updated_by)
SELECT
  'pre_event_weightage_enabled',
  'true'::jsonb,
  'Whether the pre-event score contributes to the final leaderboard total',
  '00000000-0000-0000-0000-000000000000'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.system_settings WHERE setting_key = 'pre_event_weightage_enabled'
);

INSERT INTO public.system_settings (setting_key, setting_value, description, updated_by)
SELECT
  'pre_event_weightage_pct',
  '60'::jsonb,
  'Percentage weight given to the pre-event score in the final total (the remainder goes to judge/live scoring)',
  '00000000-0000-0000-0000-000000000000'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.system_settings WHERE setting_key = 'pre_event_weightage_pct'
);

-- ── Helper: read the current weighting config ────────────────
CREATE OR REPLACE FUNCTION public.get_pre_event_weightage()
RETURNS TABLE (enabled BOOLEAN, pct NUMERIC)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(
      (SELECT (setting_value #>> '{}')::boolean FROM public.system_settings WHERE setting_key = 'pre_event_weightage_enabled'),
      true
    ),
    COALESCE(
      (SELECT (setting_value #>> '{}')::numeric FROM public.system_settings WHERE setting_key = 'pre_event_weightage_pct'),
      60
    )
$$;
GRANT EXECUTE ON FUNCTION public.get_pre_event_weightage() TO authenticated, anon;

-- ── organizer_leaderboard view ────────────────────────────────
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
  -- Jury converted score: jury average weighted by the judge share of the
  -- final total (100% when pre-event weighting is disabled).
  -- NULL for special roles (journalist/admin_student)
  CASE
    WHEN EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = p.user_id
      AND user_roles.role IN ('journalist', 'admin_student')
    ) THEN NULL
    WHEN w.enabled THEN AVG(a.total_score) * ((100 - w.pct) / 100.0)
    ELSE AVG(a.total_score)
  END AS jury_converted_score,
  -- Final total score (0-100): normalizes pre-event (0-60) and the judge
  -- component (jury average or organizer_manual_score, both -> 0-100) to a
  -- common scale, then applies the configured weighting.
  CASE
    WHEN EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = p.user_id
      AND user_roles.role IN ('journalist', 'admin_student')
    ) THEN
      CASE WHEN w.enabled THEN
        (COALESCE(p.preevent_scores, 0) * (100.0 / 60.0)) * (w.pct / 100.0)
        + (COALESCE(p.organizer_manual_score, 0) * (100.0 / 40.0)) * ((100 - w.pct) / 100.0)
      ELSE
        COALESCE(p.organizer_manual_score, 0) * (100.0 / 40.0)
      END
    ELSE
      CASE WHEN w.enabled THEN
        (COALESCE(p.preevent_scores, 0) * (100.0 / 60.0)) * (w.pct / 100.0)
        + COALESCE(AVG(a.total_score), 0) * ((100 - w.pct) / 100.0)
      ELSE
        COALESCE(AVG(a.total_score), 0)
      END
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
CROSS JOIN public.get_pre_event_weightage() w
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
  p.photo_url,
  w.enabled,
  w.pct
ORDER BY
  (CASE
    WHEN EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = p.user_id
      AND user_roles.role IN ('journalist', 'admin_student')
    ) THEN
      CASE WHEN w.enabled THEN
        (COALESCE(p.preevent_scores, 0) * (100.0 / 60.0)) * (w.pct / 100.0)
        + (COALESCE(p.organizer_manual_score, 0) * (100.0 / 40.0)) * ((100 - w.pct) / 100.0)
      ELSE
        COALESCE(p.organizer_manual_score, 0) * (100.0 / 40.0)
      END
    ELSE
      CASE WHEN w.enabled THEN
        (COALESCE(p.preevent_scores, 0) * (100.0 / 60.0)) * (w.pct / 100.0)
        + COALESCE(AVG(a.total_score), 0) * ((100 - w.pct) / 100.0)
      ELSE
        COALESCE(AVG(a.total_score), 0)
      END
  END) DESC NULLS LAST,
  p.serial_number;

-- ── get_event_leaderboard RPC ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_event_leaderboard(p_event_id UUID)
RETURNS TABLE (
  user_id         UUID,
  name            TEXT,
  "position"      TEXT,
  party_number    INT,
  constituency    TEXT,
  state           TEXT,
  serial_number   INT,
  photo_url       TEXT,
  avg_jury_score  NUMERIC,
  preevent_scores NUMERIC,
  final_score     NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.name,
    p."position",
    p.party_number,
    p.constituency,
    p.state,
    p.serial_number,
    p.photo_url,
    ROUND(AVG(a.total_score)::numeric, 2)                             AS avg_jury_score,
    COALESCE(p.preevent_scores, 0)::numeric                           AS preevent_scores,
    ROUND(
      CASE WHEN w.enabled THEN
        (COALESCE(p.preevent_scores, 0) * (100.0 / 60.0)) * (w.pct / 100.0)
        + COALESCE(AVG(a.total_score), 0) * ((100 - w.pct) / 100.0)
      ELSE
        COALESCE(AVG(a.total_score), 0)
      END,
      2
    )                                                                 AS final_score
  FROM public.profiles p
  LEFT JOIN public.assessments a
    ON a.student_id = p.user_id AND a.status = 'submitted' AND a.event_id = p_event_id
  CROSS JOIN public.get_pre_event_weightage() w
  WHERE p.event_id = p_event_id
    AND p.user_type = 'student'
  GROUP BY p.user_id, p.name, p."position", p.party_number, p.constituency,
           p.state, p.serial_number, p.photo_url, p.preevent_scores, w.enabled, w.pct
  ORDER BY final_score DESC
$$;
GRANT EXECUTE ON FUNCTION public.get_event_leaderboard(UUID) TO authenticated;
