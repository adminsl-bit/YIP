-- Create app_role enum for granular permissions
CREATE TYPE public.app_role AS ENUM ('admin_student');

-- Create user_roles table for role-based access control
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Organizers can view all roles"
ON public.user_roles FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE user_id = auth.uid() AND user_type = 'organizer'
));

CREATE POLICY "Organizers can manage all roles"
ON public.user_roles FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE user_id = auth.uid() AND user_type = 'organizer'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE user_id = auth.uid() AND user_type = 'organizer'
));

-- Update timer_sessions RLS to include admin students
DROP POLICY IF EXISTS "Only organizers can manage timers" ON public.timer_sessions;
CREATE POLICY "Organizers and admin students can manage timers"
ON public.timer_sessions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND user_type = 'organizer'
  ) OR (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND user_type = 'student'
    ) AND public.has_role(auth.uid(), 'admin_student')
  )
);

-- Update polls RLS to include admin students
DROP POLICY IF EXISTS "Only organizers can manage polls" ON public.polls;
CREATE POLICY "Organizers and admin students can manage polls"
ON public.polls FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND user_type = 'organizer'
  ) OR (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND user_type = 'student'
    ) AND public.has_role(auth.uid(), 'admin_student')
  )
);

-- Update system_settings RLS to include admin students
DROP POLICY IF EXISTS "Only organizers can manage settings" ON public.system_settings;
CREATE POLICY "Organizers and admin students can manage settings"
ON public.system_settings FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND user_type = 'organizer'
  ) OR (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND user_type = 'student'
    ) AND public.has_role(auth.uid(), 'admin_student')
  )
);