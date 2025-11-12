-- Drop all existing policies on breaking_news
DROP POLICY IF EXISTS "Everyone can view active breaking news" ON public.breaking_news;
DROP POLICY IF EXISTS "Organizers can view all breaking news" ON public.breaking_news;
DROP POLICY IF EXISTS "Organizers can manage all breaking news" ON public.breaking_news;
DROP POLICY IF EXISTS "Journalists can insert breaking news" ON public.breaking_news;
DROP POLICY IF EXISTS "Journalists can update their own breaking news" ON public.breaking_news;
DROP POLICY IF EXISTS "Journalists can delete their own breaking news" ON public.breaking_news;
DROP POLICY IF EXISTS "Journalists can view their own breaking news" ON public.breaking_news;

-- Recreate policies with organizer override capability

-- Everyone can view active breaking news
CREATE POLICY "Everyone can view active breaking news"
ON public.breaking_news
FOR SELECT
USING (is_active = true);

-- Organizers can do everything with all breaking news
CREATE POLICY "Organizers can manage all breaking news"
ON public.breaking_news
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND user_type = 'organizer'
  )
);

-- Journalists can view their own breaking news
CREATE POLICY "Journalists can view their own breaking news"
ON public.breaking_news
FOR SELECT
USING (
  has_role(auth.uid(), 'journalist') AND journalist_id = auth.uid()
);

-- Journalists can insert breaking news
CREATE POLICY "Journalists can insert breaking news"
ON public.breaking_news
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'journalist') AND journalist_id = auth.uid()
);

-- Journalists can update their own breaking news
CREATE POLICY "Journalists can update their own breaking news"
ON public.breaking_news
FOR UPDATE
USING (
  has_role(auth.uid(), 'journalist') AND journalist_id = auth.uid()
);

-- Journalists can delete their own breaking news
CREATE POLICY "Journalists can delete their own breaking news"
ON public.breaking_news
FOR DELETE
USING (
  has_role(auth.uid(), 'journalist') AND journalist_id = auth.uid()
);