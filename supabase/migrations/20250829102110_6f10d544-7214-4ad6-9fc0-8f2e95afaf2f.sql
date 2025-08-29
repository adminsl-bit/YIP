-- Add two additional jury members
-- First, we need to create auth users and then profiles

-- Insert first jury member
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'jury2@parliament.com',
  crypt('jury2pass', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"name": "Dr. Priya Sharma"}',
  false,
  'authenticated'
);

-- Insert second jury member  
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'jury3@parliament.com',
  crypt('jury3pass', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"name": "Prof. Rajesh Kumar"}',
  false,
  'authenticated'
);

-- Get the user IDs we just created to insert into profiles
WITH new_users AS (
  SELECT id, email FROM auth.users 
  WHERE email IN ('jury2@parliament.com', 'jury3@parliament.com')
)
-- Insert first jury profile
INSERT INTO public.profiles (
  user_id,
  serial_number,
  name,
  position,
  party_number,
  constituency,
  state,
  city,
  user_type
) 
SELECT 
  id,
  2002,
  'Dr. Priya Sharma',
  'Senior Advocate & Constitutional Expert',
  0,
  'Legal Advisory',
  'Tamil Nadu',
  'Madurai',
  'jury'::user_type
FROM new_users WHERE email = 'jury2@parliament.com';

-- Insert second jury profile
WITH new_users AS (
  SELECT id, email FROM auth.users 
  WHERE email IN ('jury2@parliament.com', 'jury3@parliament.com')
)
INSERT INTO public.profiles (
  user_id,
  serial_number,
  name,
  position,
  party_number,
  constituency,
  state,
  city,
  user_type
) 
SELECT 
  id,
  2003,
  'Prof. Rajesh Kumar',
  'Political Science Professor & Former IAS',
  0,
  'Academic Advisory',
  'Tamil Nadu', 
  'Madurai',
  'jury'::user_type
FROM new_users WHERE email = 'jury3@parliament.com';