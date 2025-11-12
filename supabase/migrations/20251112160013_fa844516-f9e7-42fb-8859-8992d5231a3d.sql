-- Create breaking_news table for journalist headlines
CREATE TABLE public.breaking_news (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  journalist_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  headline text NOT NULL,
  published_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT headline_length CHECK (char_length(headline) <= 1000)
);

-- Enable RLS
ALTER TABLE public.breaking_news ENABLE ROW LEVEL SECURITY;

-- Journalists can create and view their own headlines
CREATE POLICY "Journalists can insert breaking news"
ON public.breaking_news
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'journalist') AND journalist_id = auth.uid()
);

CREATE POLICY "Journalists can view their own breaking news"
ON public.breaking_news
FOR SELECT
USING (
  has_role(auth.uid(), 'journalist') AND journalist_id = auth.uid()
);

CREATE POLICY "Journalists can update their own breaking news"
ON public.breaking_news
FOR UPDATE
USING (
  has_role(auth.uid(), 'journalist') AND journalist_id = auth.uid()
);

-- Organizers can view all breaking news
CREATE POLICY "Organizers can view all breaking news"
ON public.breaking_news
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND user_type = 'organizer'
  )
);

-- Everyone can view active breaking news (for stage displays)
CREATE POLICY "Everyone can view active breaking news"
ON public.breaking_news
FOR SELECT
USING (is_active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_breaking_news_updated_at
BEFORE UPDATE ON public.breaking_news
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();