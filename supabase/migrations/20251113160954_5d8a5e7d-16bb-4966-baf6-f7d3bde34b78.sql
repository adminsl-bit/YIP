-- Update RLS policy for polls to allow viewing polls linked to active sessions
-- This allows the stage display to see inactive polls if they're part of an active session

-- Drop the existing policy
DROP POLICY IF EXISTS "Everyone can view active polls" ON polls;

-- Create updated policy that also allows viewing polls linked to active sessions
CREATE POLICY "Everyone can view active polls or polls in active sessions"
ON polls
FOR SELECT
USING (
  is_active = true 
  OR (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.user_type = ANY (ARRAY['organizer'::user_type, 'jury'::user_type])
  ))
  OR (EXISTS (
    SELECT 1 FROM session_items 
    WHERE session_items.poll_id = polls.id 
    AND session_items.is_active = true
  ))
);