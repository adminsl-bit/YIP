-- Create profiles table for Young Indians Parliament members
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  serial_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  party_number INTEGER NOT NULL,
  constituency TEXT,
  state TEXT,
  city TEXT,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(serial_number, party_number)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profile access
CREATE POLICY "Users can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND position = 'Administrator'
  ) OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid())
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample profiles based on the Excel data
INSERT INTO public.profiles (user_id, serial_number, name, position, party_number, constituency, state, city) VALUES
  -- We'll populate this after users are created through authentication
  -- This is just the structure for now
  (gen_random_uuid(), 1, 'JADEN GABRIEL ROY', 'Administrator', 1, 'Araria', 'Bihar', 'Madurai'),
  (gen_random_uuid(), 2, 'M MUTHURAJALAKSHMI', 'Parliament Member', 2, 'Purulia', 'Bihar', 'Madurai'),
  (gen_random_uuid(), 3, 'ARUSH N A', 'Shadow Minister', 3, 'Kishanganj', 'Bihar', 'Madurai'),
  (gen_random_uuid(), 4, 'PRANAV SASTHA PILLAI', 'Deputy Speaker', 4, 'Kathar', 'Bihar', 'Madurai'),
  (gen_random_uuid(), 5, 'DANUSH KUMAR SIVAKUMAR', 'Prime Minister', 5, 'Bhagalpur', 'Bihar', 'Madurai');