-- Fix security issues identified in the security scan

-- 1. Fix jury_leaderboard table - add RLS policies
ALTER TABLE public.jury_leaderboard ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view leaderboard data
CREATE POLICY "Authenticated users can view jury leaderboard"
ON public.jury_leaderboard
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 2. Restrict system_settings access - remove public access and allow only organizers
DROP POLICY IF EXISTS "Everyone can view settings" ON public.system_settings;

-- Create more restrictive policy for system settings
CREATE POLICY "Only organizers can view system settings"
ON public.system_settings
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE user_id = auth.uid() 
  AND user_type = 'organizer'
));

-- 3. Fix the Security Definer View issue by checking existing views
-- List views that might have SECURITY DEFINER property
SELECT schemaname, viewname 
FROM pg_views 
WHERE schemaname = 'public' 
AND definition LIKE '%SECURITY DEFINER%';