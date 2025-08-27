-- Add user type and session management
CREATE TYPE public.user_type AS ENUM ('student', 'jury', 'organizer');

-- Add columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN user_type user_type NOT NULL DEFAULT 'student',
ADD COLUMN email TEXT,
ADD COLUMN is_active BOOLEAN DEFAULT true,
ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN session_id TEXT;

-- Create login audit table for tracking duplicate logins (students only)
CREATE TABLE public.login_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  login_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT,
  is_duplicate_session BOOLEAN DEFAULT false,
  previous_session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on login_audit
ALTER TABLE public.login_audit ENABLE ROW LEVEL SECURITY;

-- Policies for login_audit (only admins/organizers can view)
CREATE POLICY "Organizers can view all login audits" 
ON public.login_audit 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND user_type = 'organizer'
  )
);

-- Create function to handle login audit
CREATE OR REPLACE FUNCTION public.log_user_login(
  p_user_id UUID,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_session TEXT;
  is_duplicate BOOLEAN := false;
  audit_result JSONB;
BEGIN
  -- Check if this is a student (only students have session restrictions)
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = p_user_id AND user_type = 'student'
  ) THEN
    -- Check for existing active session
    SELECT session_id INTO existing_session 
    FROM public.profiles 
    WHERE user_id = p_user_id AND session_id IS NOT NULL;
    
    -- If there's an existing session and it's different, mark as duplicate
    IF existing_session IS NOT NULL AND existing_session != p_session_id THEN
      is_duplicate := true;
    END IF;
    
    -- Update user's session
    UPDATE public.profiles 
    SET 
      session_id = p_session_id,
      last_login_at = now()
    WHERE user_id = p_user_id;
  ELSE
    -- For jury/organizer, just update last login
    UPDATE public.profiles 
    SET last_login_at = now()
    WHERE user_id = p_user_id;
  END IF;
  
  -- Log the login attempt
  INSERT INTO public.login_audit (
    user_id,
    ip_address,
    user_agent,
    session_id,
    is_duplicate_session,
    previous_session_id
  ) VALUES (
    p_user_id,
    p_ip_address,
    p_user_agent,
    p_session_id,
    is_duplicate,
    CASE WHEN is_duplicate THEN existing_session ELSE NULL END
  );
  
  -- Return result
  audit_result := jsonb_build_object(
    'success', true,
    'is_duplicate_session', is_duplicate,
    'previous_session_id', existing_session
  );
  
  RETURN audit_result;
END;
$$;

-- Update existing test profile to be student type
UPDATE public.profiles 
SET user_type = 'student', email = '00@yip.parliament'
WHERE serial_number = 0 AND party_number = 0;