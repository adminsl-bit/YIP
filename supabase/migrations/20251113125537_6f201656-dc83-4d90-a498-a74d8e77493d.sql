-- Add sort_order column to timer_sessions for drag-and-drop ordering
ALTER TABLE timer_sessions 
ADD COLUMN sort_order INTEGER DEFAULT 0;

-- Set initial sort_order based on created_at
UPDATE timer_sessions 
SET sort_order = (
  SELECT COUNT(*) 
  FROM timer_sessions t2 
  WHERE t2.created_at <= timer_sessions.created_at
);

-- Create index for better query performance
CREATE INDEX idx_timer_sessions_sort_order ON timer_sessions(sort_order);