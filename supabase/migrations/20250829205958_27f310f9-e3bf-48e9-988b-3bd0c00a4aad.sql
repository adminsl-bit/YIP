-- Create missing organizer profile for user 00@yip.parliament
INSERT INTO public.profiles (
  user_id,
  name, 
  user_type,
  serial_number,
  party_number,
  position,
  is_active
) VALUES (
  '056ce462-ddf1-431a-a2b8-3a93e4cdac72',
  'System Organizer',
  'organizer',
  0,
  0,
  'System Administrator', 
  true
);