-- Add visibility control for awards
ALTER TABLE public.awards 
ADD COLUMN visible_to_jury boolean DEFAULT true;

-- Add index for better performance
CREATE INDEX idx_awards_visible_to_jury ON public.awards(visible_to_jury);

-- Add comment for clarity
COMMENT ON COLUMN public.awards.visible_to_jury IS 'Controls whether jury members can see and vote on this award';