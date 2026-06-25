-- Align award names with the official Awards & Recognition document
UPDATE public.awards SET name = 'Most Persuasive Policy Advocate'        WHERE name = 'Most Persuasive Award';
UPDATE public.awards SET name = 'Most Valuable Participant (MVP) Award'   WHERE name = 'Most Valuable Participant';
UPDATE public.awards SET name = 'Exemplary Parliamentary Decorum Award'   WHERE name = 'Exemplary Decorum Award';
UPDATE public.awards SET name = 'Independent Voice of the House Award'    WHERE name = 'Independent Voice Award';

-- Ensure all awards are visible to jury (safe to run multiple times)
UPDATE public.awards SET visible_to_jury = true WHERE visible_to_jury IS NULL OR visible_to_jury = false;

-- Confirm final list
SELECT name, visible_to_jury FROM public.awards ORDER BY name;
