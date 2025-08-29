-- Check current state first
SELECT user_id, email, user_type, name FROM public.profiles 
WHERE email IN ('jury@yip.org', 'organizer@yip.org');

-- Swap the user types for these accounts
UPDATE public.profiles 
SET user_type = 'organizer'
WHERE email = 'jury@yip.org';

UPDATE public.profiles 
SET user_type = 'jury' 
WHERE email = 'organizer@yip.org';

-- Verify the changes
SELECT user_id, email, user_type, name FROM public.profiles 
WHERE email IN ('jury@yip.org', 'organizer@yip.org');