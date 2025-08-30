-- Add field to track when poll results should show post-analysis
ALTER TABLE public.polls 
ADD COLUMN show_post_analysis BOOLEAN NOT NULL DEFAULT false;

-- Update the updated_at trigger to include the new column
CREATE OR REPLACE FUNCTION update_polls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists for polls table
DROP TRIGGER IF EXISTS update_polls_updated_at_trigger ON public.polls;
CREATE TRIGGER update_polls_updated_at_trigger
  BEFORE UPDATE ON public.polls
  FOR EACH ROW
  EXECUTE FUNCTION update_polls_updated_at();

-- Add comment for documentation
COMMENT ON COLUMN public.polls.show_post_analysis IS 'When true, displays post-voting analysis on stage screen';