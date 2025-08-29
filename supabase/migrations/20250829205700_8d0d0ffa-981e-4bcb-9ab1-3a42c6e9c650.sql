-- Delete all organizer profiles
DELETE FROM public.profiles 
WHERE user_type = 'organizer';

-- Delete all jury profiles  
DELETE FROM public.profiles 
WHERE user_type = 'jury';