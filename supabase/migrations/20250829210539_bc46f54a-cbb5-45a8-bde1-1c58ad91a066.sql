-- Clean up any existing profiles for the emails to be deleted
DELETE FROM public.profiles 
WHERE email IN ('jury@yip.org', 'organizer@yip.org', 'jury2@parliament.com', 'jury3@parliament.com');