-- Create a single organizer user profile
INSERT INTO public.profiles (
  user_id,
  serial_number,
  name,
  position,
  party_number,
  constituency,
  state,
  city,
  user_type,
  email,
  is_active
) VALUES (
  gen_random_uuid(),
  0,
  'System Organizer',
  'Event Organizer',
  0,
  'System',
  'System',
  'System',
  'organizer',
  '00@yip.org',
  true
);