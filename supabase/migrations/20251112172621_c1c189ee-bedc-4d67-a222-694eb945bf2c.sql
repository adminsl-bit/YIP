-- Add journalist_name column to breaking_news table
ALTER TABLE public.breaking_news
ADD COLUMN journalist_name TEXT;

-- Update existing records to populate journalist_name from profiles
UPDATE public.breaking_news bn
SET journalist_name = p.name
FROM public.profiles p
WHERE bn.journalist_id = p.user_id
AND bn.journalist_name IS NULL;