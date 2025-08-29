-- Delete all profiles from party 0
DELETE FROM public.profiles 
WHERE party_number = 0;

-- Delete all profiles with "Nap" in the name (case insensitive)
DELETE FROM public.profiles 
WHERE LOWER(name) LIKE '%nap%';