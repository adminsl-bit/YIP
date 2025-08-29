-- Storage policies for profile photo uploads in student-photos bucket
-- Allow jury users to manage files only within jury/{userId}/ path

-- INSERT policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Jury can upload own profile photos'
  ) THEN
    CREATE POLICY "Jury can upload own profile photos"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
      bucket_id = 'student-photos'
      AND (storage.foldername(name))[1] = 'jury'
      AND auth.uid()::text = (storage.foldername(name))[2]
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid() AND p.user_type = 'jury'
      )
    );
  END IF;
END
$$;

-- UPDATE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Jury can update own profile photos'
  ) THEN
    CREATE POLICY "Jury can update own profile photos"
    ON storage.objects
    FOR UPDATE
    USING (
      bucket_id = 'student-photos'
      AND (storage.foldername(name))[1] = 'jury'
      AND auth.uid()::text = (storage.foldername(name))[2]
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid() AND p.user_type = 'jury'
      )
    )
    WITH CHECK (
      bucket_id = 'student-photos'
      AND (storage.foldername(name))[1] = 'jury'
      AND auth.uid()::text = (storage.foldername(name))[2]
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid() AND p.user_type = 'jury'
      )
    );
  END IF;
END
$$;

-- DELETE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Jury can delete own profile photos'
  ) THEN
    CREATE POLICY "Jury can delete own profile photos"
    ON storage.objects
    FOR DELETE
    USING (
      bucket_id = 'student-photos'
      AND (storage.foldername(name))[1] = 'jury'
      AND auth.uid()::text = (storage.foldername(name))[2]
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid() AND p.user_type = 'jury'
      )
    );
  END IF;
END
$$;