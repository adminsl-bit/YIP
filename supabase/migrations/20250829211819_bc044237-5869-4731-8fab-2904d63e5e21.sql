-- Create profile for organizer (checking if it doesn't exist first)
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
) 
SELECT 
  'b1f80cd9-dcba-45fd-9dd4-ae86ad62830a',
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
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE user_id = 'b1f80cd9-dcba-45fd-9dd4-ae86ad62830a'
);

-- Create profile for Jury 1 - Tulsi Patel
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
  photo_url,
  is_active
) 
SELECT 
  '413a4f0d-bfa5-4c2a-8f67-fa8b1c925f38',
  1,
  'Tulsi Patel',
  'National Trainer JCI',
  0,
  'System',
  'System',
  'System',
  'jury',
  'jury1@yip.org',
  '/lovable-uploads/78910ea7-caa5-46a8-a794-2c3742aa297b.png',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE user_id = '413a4f0d-bfa5-4c2a-8f67-fa8b1c925f38'
);

-- Create profile for Jury 2 - Hariharan
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
  photo_url,
  is_active
) 
SELECT 
  '1fd8e2e8-897b-427b-a27e-72cd80f59783',
  2,
  'Hariharan',
  'Advocate, KV Law Firm',
  0,
  'System',
  'System',
  'System',
  'jury',
  'jury2@yip.org',
  '/lovable-uploads/7ff2f189-e9b0-442c-afd7-d7b210514a59.png',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE user_id = '1fd8e2e8-897b-427b-a27e-72cd80f59783'
);

-- Create profile for Jury 3 - P.Thangaraj
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
  photo_url,
  is_active
) 
SELECT 
  '72ad2be3-24dc-406e-967e-1105f96621ef',
  3,
  'P.Thangaraj',
  'Assistant Professor, N.M.S.S.Vellaichamy Nadar College',
  0,
  'System',
  'System',
  'System',
  'jury',
  'jury3@yip.org',
  '/lovable-uploads/560287e5-be09-4ae4-a9e2-296f25463a9c.png',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE user_id = '72ad2be3-24dc-406e-967e-1105f96621ef'
);