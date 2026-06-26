-- YIP Madurai 2026 — full two-day agenda
-- Event: 57edea74-bf80-4a21-910f-f3ea971f06ec
-- created_by: first organizer assigned to this event

DO $$
DECLARE
  ev   UUID := '57edea74-bf80-4a21-910f-f3ea971f06ec';
  org  UUID;
BEGIN
  -- Get the organiser for this event (fallback to super_admin if none)
  SELECT user_id INTO org
  FROM profiles
  WHERE event_id = ev AND user_type IN ('organizer','super_admin')
  ORDER BY created_at LIMIT 1;

  IF org IS NULL THEN
    SELECT user_id INTO org FROM profiles WHERE user_type = 'super_admin' ORDER BY created_at LIMIT 1;
  END IF;

  -- Remove any existing agenda items for this event before re-seeding
  DELETE FROM session_items WHERE event_id = ev;

  -- ──────────────────────────────────────────────
  --  DAY 1  –  2026-06-28
  -- ──────────────────────────────────────────────
  INSERT INTO session_items (title, description, bill_type, sort_order, session_date, event_id, created_by) VALUES
  ('Registration',
   '8:00 AM – 9:00 AM · Delegate registration and check-in',
   'general_discussion', 10, '2026-06-28', ev, org),

  ('Inaugural Ceremony',
   '9:00 AM – 10:00 AM · Opening of the session',
   'general_discussion', 20, '2026-06-28', ev, org),

  ('Speaker Election / Selection',
   '10:00 AM – 10:15 AM · Election or selection of the Speaker of the House',
   'general_discussion', 30, '2026-06-28', ev, org),

  ('Speaker Oath · PM & LOP Address',
   '10:15 AM – 10:30 AM · Speaker oath taking; Prime Minister and Leader of Opposition each deliver a 1-minute address',
   'general_discussion', 40, '2026-06-28', ev, org),

  ('90-Second Speeches — Part 1',
   '10:30 AM – 11:15 AM · Delegates deliver their 90-second Matters of Urgent Public Importance speeches',
   'general_discussion', 50, '2026-06-28', ev, org),

  ('Break',
   '11:15 AM – 11:30 AM',
   'general_discussion', 60, '2026-06-28', ev, org),

  ('90-Second Speeches — Part 2',
   '11:30 AM – 1:00 PM · Delegates continue 90-second MUPI speeches',
   'general_discussion', 70, '2026-06-28', ev, org),

  ('Lunch Break',
   '1:00 PM – 2:00 PM',
   'general_discussion', 80, '2026-06-28', ev, org),

  ('Question Hour',
   '2:00 PM – 2:45 PM · 5 questions, 8 minutes each (including 5 follow-ups per question)',
   'question_hour', 90, '2026-06-28', ev, org),

  ('Committee Bill Presentations — 4 Bills',
   '2:45 PM – 3:45 PM · 4 committee bills, 10 minutes each (4 min presentation + 4 min Q&A + 2 min closing)',
   'committee_report', 100, '2026-06-28', ev, org),

  ('Instructions & Closing Remarks — Day 1',
   '3:45 PM – 4:00 PM · Day 1 wrap-up and instructions for Day 2',
   'general_discussion', 110, '2026-06-28', ev, org);

  -- ──────────────────────────────────────────────
  --  DAY 2  –  2026-06-29
  -- ──────────────────────────────────────────────
  INSERT INTO session_items (title, description, bill_type, sort_order, session_date, event_id, created_by) VALUES
  ('Recap & Instructions',
   '9:00 AM – 9:15 AM · Event mentor and chair recap of Day 1; instructions for the day',
   'general_discussion', 10, '2026-06-29', ev, org),

  ('90-Second Speeches — Remaining',
   '9:15 AM – 11:15 AM · Remaining delegates deliver their 90-second MUPI speeches',
   'general_discussion', 20, '2026-06-29', ev, org),

  ('Break',
   '11:15 AM – 11:30 AM',
   'general_discussion', 30, '2026-06-29', ev, org),

  ('Question Hour — Pending Questions',
   '11:30 AM – 12:30 PM · Remaining 5 questions, 8 minutes each',
   'question_hour', 40, '2026-06-29', ev, org),

  ('Committee Bill Presentations — 2 Bills',
   '12:30 PM – 1:00 PM · 2 committee bills',
   'committee_report', 50, '2026-06-29', ev, org),

  ('Lunch Break',
   '1:00 PM – 2:00 PM',
   'general_discussion', 60, '2026-06-29', ev, org),

  ('Zero Hour',
   '2:00 PM – 3:00 PM · Zero Hour — delegates raise urgent matters of public concern',
   'general_discussion', 70, '2026-06-29', ev, org),

  ('Committee Bill Presentations — 2 Bills',
   '3:00 PM – 3:30 PM · Final 2 committee bills',
   'committee_report', 80, '2026-06-29', ev, org),

  ('Consolidation of Speeches',
   '3:30 PM – 4:00 PM · Review and consolidation of delegate speeches for scoring',
   'general_discussion', 90, '2026-06-29', ev, org),

  ('Valediction',
   '4:00 PM – 5:00 PM · Closing ceremony, award presentation and valediction',
   'general_discussion', 100, '2026-06-29', ev, org);

END $$;

-- Verify
SELECT session_date, sort_order, title
FROM session_items
WHERE event_id = '57edea74-bf80-4a21-910f-f3ea971f06ec'
ORDER BY session_date, sort_order;
