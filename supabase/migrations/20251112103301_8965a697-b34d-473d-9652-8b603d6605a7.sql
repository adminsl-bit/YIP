-- Enable students to upload and manage their own photos in the student-photos bucket

-- Students can upload their own photos (file path must start with their user_id)
CREATE POLICY "Students can upload their own photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'student-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Students can update their own photos
CREATE POLICY "Students can update their own photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'student-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Students can delete their own photos
CREATE POLICY "Students can delete their own photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'student-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Everyone can view photos in the public bucket
CREATE POLICY "Anyone can view student photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'student-photos');
