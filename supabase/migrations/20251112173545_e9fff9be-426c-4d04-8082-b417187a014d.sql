-- Allow journalists to delete their own breaking news
CREATE POLICY "Journalists can delete their own breaking news"
ON public.breaking_news
FOR DELETE
USING (
  has_role(auth.uid(), 'journalist'::app_role) 
  AND journalist_id = auth.uid()
);