-- Create timer_sessions for every Madurai agenda item and link them via timer_id.
-- Durations are derived from the time ranges in each item's description.

DO $$
DECLARE
  ev   UUID := '57edea74-bf80-4a21-910f-f3ea971f06ec';
  org  UUID;
  tid  UUID;
BEGIN
  SELECT user_id INTO org
  FROM profiles WHERE event_id = ev AND user_type IN ('organizer','super_admin')
  ORDER BY created_at LIMIT 1;

  IF org IS NULL THEN
    SELECT user_id INTO org FROM profiles WHERE user_type = 'super_admin' ORDER BY created_at LIMIT 1;
  END IF;

  -- Helper: create a timer and link it to a session_item by title match
  -- ── DAY 1 ──────────────────────────────────────────────────────────────────
  INSERT INTO timer_sessions(id,title,duration_seconds,remaining_seconds,status,event_id,created_by)
  VALUES(gen_random_uuid(),'Registration',3600,3600,'stopped',ev,org) RETURNING id INTO tid;
  UPDATE session_items SET timer_id=tid WHERE event_id=ev AND title='Registration';

  INSERT INTO timer_sessions(id,title,duration_seconds,remaining_seconds,status,event_id,created_by)
  VALUES(gen_random_uuid(),'Inaugural Ceremony',3600,3600,'stopped',ev,org) RETURNING id INTO tid;
  UPDATE session_items SET timer_id=tid WHERE event_id=ev AND title='Inaugural Ceremony';

  INSERT INTO timer_sessions(id,title,duration_seconds,remaining_seconds,status,event_id,created_by)
  VALUES(gen_random_uuid(),'Speaker Election / Selection',900,900,'stopped',ev,org) RETURNING id INTO tid;
  UPDATE session_items SET timer_id=tid WHERE event_id=ev AND title='Speaker Election / Selection';

  INSERT INTO timer_sessions(id,title,duration_seconds,remaining_seconds,status,event_id,created_by)
  VALUES(gen_random_uuid(),'Speaker Oath · PM & LOP Address',900,900,'stopped',ev,org) RETURNING id INTO tid;
  UPDATE session_items SET timer_id=tid WHERE event_id=ev AND title='Speaker Oath · PM & LOP Address';

  INSERT INTO timer_sessions(id,title,duration_seconds,remaining_seconds,status,event_id,created_by)
  VALUES(gen_random_uuid(),'90-Second Speeches — Part 1',2700,2700,'stopped',ev,org) RETURNING id INTO tid;
  UPDATE session_items SET timer_id=tid WHERE event_id=ev AND title='90-Second Speeches — Part 1';

  INSERT INTO timer_sessions(id,title,duration_seconds,remaining_seconds,status,event_id,created_by)
  VALUES(gen_random_uuid(),'Break (Day 1 AM)',900,900,'stopped',ev,org) RETURNING id INTO tid;
  UPDATE session_items SET timer_id=tid WHERE event_id=ev AND title='Break' AND session_date='2026-06-27' AND sort_order=60;

  INSERT INTO timer_sessions(id,title,duration_seconds,remaining_seconds,status,event_id,created_by)
  VALUES(gen_random_uuid(),'90-Second Speeches — Part 2',5400,5400,'stopped',ev,org) RETURNING id INTO tid;
  UPDATE session_items SET timer_id=tid WHERE event_id=ev AND title='90-Second Speeches — Part 2';

  INSERT INTO timer_sessions(id,title,duration_seconds,remaining_seconds,status,event_id,created_by)
  VALUES(gen_random_uuid(),'Lunch Break (Day 1)',3600,3600,'stopped',ev,org) RETURNING id INTO tid;
  UPDATE session_items SET timer_id=tid WHERE event_id=ev AND title='Lunch Break' AND session_date='2026-06-27';

  INSERT INTO timer_sessions(id,title,duration_seconds,remaining_seconds,status,event_id,created_by)
  VALUES(gen_random_uuid(),'Question Hour',2700,2700,'stopped',ev,org) RETURNING id INTO tid;
  UPDATE session_items SET timer_id=tid WHERE event_id=ev AND title='Question Hour';

  INSERT INTO timer_sessions(id,title,duration_seconds,remaining_seconds,status,event_id,created_by)
  VALUES(gen_random_uuid(),'Committee Bill Presentations — 4 Bills',3600,3600,'stopped',ev,org) RETURNING id INTO tid;
  UPDATE session_items SET timer_id=tid WHERE event_id=ev AND title='Committee Bill Presentations — 4 Bills';

  INSERT INTO timer_sessions(id,title,duration_seconds,remaining_seconds,status,event_id,created_by)
  VALUES(gen_random_uuid(),'Instructions & Closing Remarks — Day 1',900,900,'stopped',ev,org) RETURNING id INTO tid;
  UPDATE session_items SET timer_id=tid WHERE event_id=ev AND title='Instructions & Closing Remarks — Day 1';

  -- ── DAY 2 ──────────────────────────────────────────────────────────────────
  INSERT INTO timer_sessions(id,title,duration_seconds,remaining_seconds,status,event_id,created_by)
  VALUES(gen_random_uuid(),'Recap & Instructions',900,900,'stopped',ev,org) RETURNING id INTO tid;
  UPDATE session_items SET timer_id=tid WHERE event_id=ev AND title='Recap & Instructions';

  INSERT INTO timer_sessions(id,title,duration_seconds,remaining_seconds,status,event_id,created_by)
  VALUES(gen_random_uuid(),'90-Second Speeches — Remaining',7200,7200,'stopped',ev,org) RETURNING id INTO tid;
  UPDATE session_items SET timer_id=tid WHERE event_id=ev AND title='90-Second Speeches — Remaining';

  INSERT INTO timer_sessions(id,title,duration_seconds,remaining_seconds,status,event_id,created_by)
  VALUES(gen_random_uuid(),'Break (Day 2)',900,900,'stopped',ev,org) RETURNING id INTO tid;
  UPDATE session_items SET timer_id=tid WHERE event_id=ev AND title='Break' AND session_date='2026-06-28';

  INSERT INTO timer_sessions(id,title,duration_seconds,remaining_seconds,status,event_id,created_by)
  VALUES(gen_random_uuid(),'Question Hour — Pending Questions',3600,3600,'stopped',ev,org) RETURNING id INTO tid;
  UPDATE session_items SET timer_id=tid WHERE event_id=ev AND title='Question Hour — Pending Questions';

  INSERT INTO timer_sessions(id,title,duration_seconds,remaining_seconds,status,event_id,created_by)
  VALUES(gen_random_uuid(),'Committee Bill Presentations (Day 2 AM)',1800,1800,'stopped',ev,org) RETURNING id INTO tid;
  UPDATE session_items SET timer_id=tid WHERE event_id=ev AND title='Committee Bill Presentations — 2 Bills' AND sort_order=240;

  INSERT INTO timer_sessions(id,title,duration_seconds,remaining_seconds,status,event_id,created_by)
  VALUES(gen_random_uuid(),'Lunch Break (Day 2)',3600,3600,'stopped',ev,org) RETURNING id INTO tid;
  UPDATE session_items SET timer_id=tid WHERE event_id=ev AND title='Lunch Break' AND session_date='2026-06-28';

  INSERT INTO timer_sessions(id,title,duration_seconds,remaining_seconds,status,event_id,created_by)
  VALUES(gen_random_uuid(),'Zero Hour',3600,3600,'stopped',ev,org) RETURNING id INTO tid;
  UPDATE session_items SET timer_id=tid WHERE event_id=ev AND title='Zero Hour';

  INSERT INTO timer_sessions(id,title,duration_seconds,remaining_seconds,status,event_id,created_by)
  VALUES(gen_random_uuid(),'Committee Bill Presentations (Day 2 PM)',1800,1800,'stopped',ev,org) RETURNING id INTO tid;
  UPDATE session_items SET timer_id=tid WHERE event_id=ev AND title='Committee Bill Presentations — 2 Bills' AND sort_order=270;

  INSERT INTO timer_sessions(id,title,duration_seconds,remaining_seconds,status,event_id,created_by)
  VALUES(gen_random_uuid(),'Consolidation of Speeches',1800,1800,'stopped',ev,org) RETURNING id INTO tid;
  UPDATE session_items SET timer_id=tid WHERE event_id=ev AND title='Consolidation of Speeches';

  INSERT INTO timer_sessions(id,title,duration_seconds,remaining_seconds,status,event_id,created_by)
  VALUES(gen_random_uuid(),'Valediction',3600,3600,'stopped',ev,org) RETURNING id INTO tid;
  UPDATE session_items SET timer_id=tid WHERE event_id=ev AND title='Valediction';

END $$;

-- Confirm linkage
SELECT si.title, si.session_date, ts.title AS timer, ts.duration_seconds/60 AS minutes
FROM session_items si
JOIN timer_sessions ts ON ts.id = si.timer_id
WHERE si.event_id = '57edea74-bf80-4a21-910f-f3ea971f06ec'
ORDER BY si.sort_order;
