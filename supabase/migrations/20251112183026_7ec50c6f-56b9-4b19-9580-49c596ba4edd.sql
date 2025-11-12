-- Add organizer manual score field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN organizer_manual_score numeric(5,2) DEFAULT NULL;

COMMENT ON COLUMN public.profiles.organizer_manual_score IS 'Manual score added by organizers for journalists and admin students (out of 100)';

-- Create a view for organizer to manage manual scores
CREATE OR REPLACE VIEW public.organizer_manual_scoring AS
SELECT 
  p.user_id,
  p.serial_number,
  p.name,
  p.position,
  p.party_number,
  p.party_name,
  p.photo_url,
  p.user_type,
  p.organizer_manual_score,
  CASE 
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = p.user_id AND role = 'journalist') THEN 'journalist'
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = p.user_id AND role = 'admin_student') THEN 'admin_student'
    ELSE NULL
  END as special_role
FROM public.profiles p
WHERE p.user_type = 'student' 
  AND (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = p.user_id AND role = 'journalist')
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = p.user_id AND role = 'admin_student')
  )
ORDER BY p.serial_number;