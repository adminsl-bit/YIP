-- Add party_name column to profiles table
ALTER TABLE profiles ADD COLUMN party_name TEXT;

-- Update party names based on party numbers
UPDATE profiles SET party_name = 'Sangam Ekta Samanvay' WHERE party_number = 1;
UPDATE profiles SET party_name = 'Association of Unity, Reform and Accountability (AURA)' WHERE party_number = 2;
UPDATE profiles SET party_name = 'Rising India Front Alliance' WHERE party_number = 3;
UPDATE profiles SET party_name = 'People''s Voice Party (PVP)' WHERE party_number = 4;
UPDATE profiles SET party_name = 'United Horizon Front' WHERE party_number = 5;
UPDATE profiles SET party_name = 'Manifesto Saman Vikas Party' WHERE party_number = 6;
UPDATE profiles SET party_name = 'Development, Empowerment and Vision Party (DEV)' WHERE party_number = 7;