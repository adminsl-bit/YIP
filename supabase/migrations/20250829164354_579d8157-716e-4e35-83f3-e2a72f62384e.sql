-- Fix broken photo URLs that have ?v= instead of &v= in cache busting
UPDATE profiles 
SET photo_url = REPLACE(photo_url, 'format=webp?v=', 'format=webp&v=')
WHERE user_type = 'student' 
AND photo_url LIKE '%supabase.co%' 
AND photo_url LIKE '%format=webp?v=%';