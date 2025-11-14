-- Function to enforce single-session login for students, journalists, and admin students
-- This function will terminate any existing sessions before allowing a new login

CREATE OR REPLACE FUNCTION public.enforce_single_session_login(
  p_user_id uuid,
  p_new_session_id text,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_type user_type;
  v_is_admin_student boolean;
  v_is_journalist boolean;
  v_existing_session_id text;
  v_should_enforce boolean := false;
  v_previous_session_terminated boolean := false;
BEGIN
  -- Get user type and check roles
  SELECT 
    p.user_type,
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = p_user_id 
      AND ur.role = 'admin_student'
    ),
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = p_user_id 
      AND ur.role = 'journalist'
    )
  INTO v_user_type, v_is_admin_student, v_is_journalist
  FROM profiles p
  WHERE p.user_id = p_user_id;

  -- Determine if we should enforce single session
  -- Enforce for: students, admin_students, and journalists
  IF v_user_type = 'student' OR v_is_admin_student OR v_is_journalist THEN
    v_should_enforce := true;
  END IF;

  -- If enforcement is needed, check for existing session
  IF v_should_enforce THEN
    -- Get existing session ID
    SELECT session_id INTO v_existing_session_id
    FROM profiles
    WHERE user_id = p_user_id AND session_id IS NOT NULL;

    -- If there's an existing session that's different from the new one
    IF v_existing_session_id IS NOT NULL AND v_existing_session_id != p_new_session_id THEN
      v_previous_session_terminated := true;
      
      -- Log the termination in login_audit
      INSERT INTO login_audit (
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
        p_new_session_id,
        true,
        v_existing_session_id
      );
    END IF;
  END IF;

  -- Update the user's session (this happens for all users)
  UPDATE profiles
  SET 
    session_id = p_new_session_id,
    last_login_at = now()
  WHERE user_id = p_user_id;

  -- Return status
  RETURN jsonb_build_object(
    'success', true,
    'session_enforcement_active', v_should_enforce,
    'previous_session_terminated', v_previous_session_terminated,
    'user_type', v_user_type,
    'is_admin_student', v_is_admin_student,
    'is_journalist', v_is_journalist
  );
END;
$$;