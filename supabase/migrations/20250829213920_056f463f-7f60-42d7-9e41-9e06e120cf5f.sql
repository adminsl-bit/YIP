-- Update Jury 1 (Tulsi Patel) with the correct new photo
UPDATE profiles 
SET photo_url = '/lovable-uploads/55708ca9-3c3f-4aa9-b4cf-8b9d78c87506.png',
    updated_at = now()
WHERE user_type = 'jury' AND serial_number = 1;