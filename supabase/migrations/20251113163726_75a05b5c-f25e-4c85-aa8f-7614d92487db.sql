-- Create session_sub_items table for questions, bills, reports under parent sessions
CREATE TABLE IF NOT EXISTS public.session_sub_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_session_id UUID NOT NULL REFERENCES public.session_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  sort_order INTEGER DEFAULT 0,
  poll_id UUID REFERENCES public.polls(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.session_sub_items ENABLE ROW LEVEL SECURITY;

-- Everyone can view active sub-items or if they're authenticated
CREATE POLICY "Everyone can view session sub-items"
  ON public.session_sub_items
  FOR SELECT
  USING (
    is_active = true 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND user_type IN ('organizer', 'jury', 'student')
    )
  );

-- Organizers and admin students can manage sub-items
CREATE POLICY "Organizers and admin students can manage session sub-items"
  ON public.session_sub_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND user_type = 'organizer'
    )
    OR (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() 
        AND user_type = 'student'
      )
      AND has_role(auth.uid(), 'admin_student')
    )
  );

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_session_sub_items_updated_at
  BEFORE UPDATE ON public.session_sub_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_session_sub_items_parent ON public.session_sub_items(parent_session_id);
CREATE INDEX idx_session_sub_items_sort ON public.session_sub_items(parent_session_id, sort_order);