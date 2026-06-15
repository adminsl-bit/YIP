-- Adds a phone number field to profiles, collected during the simplified
-- bulk-import flow (Name, School, Email, Phone) alongside the existing
-- `school` column.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
