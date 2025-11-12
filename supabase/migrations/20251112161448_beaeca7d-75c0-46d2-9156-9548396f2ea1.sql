-- Add preevent_scores column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preevent_scores NUMERIC;

-- Add comment to explain the column
COMMENT ON COLUMN public.profiles.preevent_scores IS 'Pre-event scores for students, visible only to organizers';

-- Update the app_role enum to include journalist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t 
                 JOIN pg_enum e ON t.oid = e.enumtypid 
                 WHERE t.typname = 'app_role' AND e.enumlabel = 'journalist') THEN
    ALTER TYPE public.app_role ADD VALUE 'journalist';
  END IF;
END $$;