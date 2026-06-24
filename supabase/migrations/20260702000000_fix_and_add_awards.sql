-- Fix typo: Best Debator → Best Debater
UPDATE public.awards SET name = 'Best Debater Award' WHERE name = 'Best Debator Award';

-- Remove "Best Leader of the House" — "Best Speaker Award" already covers this
DELETE FROM public.awards WHERE name = 'Best Leader of the House';

-- Add the 5 missing awards (skip if they already exist to keep idempotent)
INSERT INTO public.awards (name, description) VALUES
  ('Best Research & Presentation Award',     'Outstanding research quality and presentation skill across sessions')
ON CONFLICT DO NOTHING;

INSERT INTO public.awards (name, description) VALUES
  ('Best Constituency Representative Award', 'Strongest voice for their constituency across Urgent Importance, Question Hour and Zero Hour')
ON CONFLICT DO NOTHING;

INSERT INTO public.awards (name, description) VALUES
  ('Exemplary Decorum Award',                'Best parliamentary conduct with no disciplinary flag throughout the event')
ON CONFLICT DO NOTHING;

INSERT INTO public.awards (name, description) VALUES
  ('Best Member — Ruling Bench Award',       'Top-performing member from the ruling coalition across Debate, Question Hour and Bill sessions')
ON CONFLICT DO NOTHING;

INSERT INTO public.awards (name, description) VALUES
  ('Best Member — Opposition Bench Award',   'Top-performing member from the opposition bench across Question Hour, Zero Hour and Debate')
ON CONFLICT DO NOTHING;

INSERT INTO public.awards (name, description) VALUES
  ('Independent Voice Award',                'Outstanding independent contribution across Debate, Zero Hour and Question Hour')
ON CONFLICT DO NOTHING;

-- Confirm final award list
SELECT name FROM public.awards ORDER BY name;
