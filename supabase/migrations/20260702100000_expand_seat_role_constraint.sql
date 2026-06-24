-- Expand the seat_role check constraint to cover all roles returned by getSeatRole().
-- The old constraint only allowed 'speaker' | 'deputy_speaker' | 'mp',
-- which caused inserts to fail for prime_minister, minister, leader_of_opposition, etc.

ALTER TABLE public.assessments
  DROP CONSTRAINT IF EXISTS assessments_seat_role_check;

ALTER TABLE public.assessments
  ADD CONSTRAINT assessments_seat_role_check
  CHECK (seat_role IN (
    'prime_minister',
    'deputy_prime_minister',
    'speaker',
    'deputy_speaker',
    'nominated_speaker',
    'leader_of_opposition',
    'coalition_leader',
    'minister',
    'shadow_minister',
    'party_leader',
    'committee_chair',
    'mp'
  ));
