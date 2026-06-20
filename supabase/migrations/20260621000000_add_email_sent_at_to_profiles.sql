-- Track when a student's login credentials were last emailed to them.
-- NULL = never emailed. Used by the organiser student list to show an
-- "Emailed" badge and identify students who still need manual code sharing.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz DEFAULT NULL;
