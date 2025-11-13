-- Create enum for bill/session types
CREATE TYPE bill_type AS ENUM (
  'private_member_bill',
  'government_bill',
  'committee_report',
  'question_hour',
  'general_discussion'
);

-- Create session_items table for parliament agenda management
CREATE TABLE session_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  bill_type bill_type NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  
  -- Linked resources
  timer_id UUID REFERENCES timer_sessions(id) ON DELETE SET NULL,
  poll_id UUID REFERENCES polls(id) ON DELETE SET NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  
  -- Metadata
  session_date DATE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE session_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Everyone can view active session items"
  ON session_items FOR SELECT
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND user_type IN ('organizer', 'jury', 'student')
  ));

CREATE POLICY "Organizers and admin students can manage session items"
  ON session_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND user_type = 'organizer'
    ) OR (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() 
        AND user_type = 'student'
      ) AND has_role(auth.uid(), 'admin_student')
    )
  );

-- Create index for sort order
CREATE INDEX idx_session_items_sort_order ON session_items(sort_order);
CREATE INDEX idx_session_items_status ON session_items(status);
CREATE INDEX idx_session_items_is_active ON session_items(is_active);

-- Trigger for updated_at
CREATE TRIGGER update_session_items_updated_at
  BEFORE UPDATE ON session_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE session_items;