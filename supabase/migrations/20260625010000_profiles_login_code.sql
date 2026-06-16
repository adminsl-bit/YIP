-- Login code for "enter code only" student login
--
-- Bulk-imported students get a permanent 6-digit password, which now also
-- doubles as a "login code": students can sign in with just this code,
-- without typing their email. The code must be unique across all students
-- so a code alone can resolve to exactly one account.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS login_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_login_code_unique
  ON public.profiles (login_code)
  WHERE login_code IS NOT NULL;
