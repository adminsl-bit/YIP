-- Enable anonymous access to polls and poll_votes for stage display
-- This allows the stage display to work without authentication

-- Create a view for public poll access (active polls and polls marked for post-analysis)
CREATE OR REPLACE VIEW public.public_polls AS
SELECT 
  id, title, description, options, is_active, 
  show_results_publicly, show_post_analysis, 
  created_at, updated_at
FROM public.polls
WHERE is_active = true OR show_post_analysis = true;

-- Create a view for public poll votes access
CREATE OR REPLACE VIEW public.public_poll_votes AS
SELECT 
  poll_id, option_id
FROM public.poll_votes pv
WHERE EXISTS (
  SELECT 1 FROM public.polls p 
  WHERE p.id = pv.poll_id 
  AND (p.is_active = true OR p.show_post_analysis = true)
);

-- Grant access to anonymous users for these views
GRANT SELECT ON public.public_polls TO anon;
GRANT SELECT ON public.public_poll_votes TO anon;