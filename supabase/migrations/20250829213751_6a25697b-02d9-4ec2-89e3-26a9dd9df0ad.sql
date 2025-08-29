-- Update Jury 1 (Tulsi Patel) photo to the newly uploaded image
UPDATE profiles 
SET photo_url = '/lovable-uploads/a8ff0177-e036-4789-8e27-e203eb0f19ba.png'
WHERE user_type = 'jury' AND serial_number = 1;