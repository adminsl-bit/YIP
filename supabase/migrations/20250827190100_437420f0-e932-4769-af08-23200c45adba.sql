-- Create a function to help with user account setup
CREATE OR REPLACE FUNCTION public.create_user_profile(
  p_user_id UUID,
  p_serial_number INTEGER,
  p_name TEXT,
  p_position TEXT,
  p_party_number INTEGER,
  p_constituency TEXT,
  p_state TEXT,
  p_city TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    serial_number,
    name,
    position,
    party_number,
    constituency,
    state,
    city
  ) VALUES (
    p_user_id,
    p_serial_number,
    p_name,
    p_position,
    p_party_number,
    p_constituency,
    p_state,
    p_city
  );
END;
$$;