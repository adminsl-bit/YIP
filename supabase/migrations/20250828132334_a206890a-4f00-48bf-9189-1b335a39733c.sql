-- Enable real-time updates for the assessments table
ALTER TABLE public.assessments REPLICA IDENTITY FULL;

-- Add the assessments table to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.assessments;

-- Enable real-time updates for the profiles table as well (for student data changes)
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- Add the profiles table to the supabase_realtime publication  
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;