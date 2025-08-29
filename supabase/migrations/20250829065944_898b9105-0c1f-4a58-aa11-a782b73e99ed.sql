-- Fix the roles to be correct:
-- jury@yip.org should be 'jury' type
-- organizer@yip.org should be 'organizer' type

UPDATE public.profiles 
SET user_type = 'jury'
WHERE email = 'jury@yip.org';

UPDATE public.profiles 
SET user_type = 'organizer' 
WHERE email = 'organizer@yip.org';

-- Verify the correct setup
SELECT user_id, email, user_type, name FROM public.profiles 
WHERE email IN ('jury@yip.org', 'organizer@yip.org');