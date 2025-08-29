-- Update the organizer profile to ensure correct serial number for user "00"
UPDATE public.profiles 
SET 
  serial_number = 0,
  name = 'System Organizer',
  position = 'System Administrator'
WHERE user_id = '056ce462-ddf1-431a-a2b8-3a93e4cdac72';

-- Note: Password for user 00@yip.parliament needs to be set to "0025" through Supabase Auth Admin