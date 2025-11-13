-- Add is_active field to timer_sessions for better management like polls
ALTER TABLE timer_sessions 
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT false;

-- Create index for faster queries on active timers
CREATE INDEX idx_timer_sessions_active ON timer_sessions(is_active);

-- Add constraint to ensure only one timer can be active at a time
CREATE UNIQUE INDEX idx_timer_sessions_single_active 
ON timer_sessions(is_active) 
WHERE is_active = true;