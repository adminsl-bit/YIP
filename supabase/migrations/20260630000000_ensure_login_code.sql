-- Idempotent function: generates + assigns a unique 6-digit login_code to a
-- student profile if they don't have one yet, then returns it.
-- Used for self-registered students (email OTP and direct enrollment) so
-- they can also use the "login with code" flow, just like bulk-imported students.
CREATE OR REPLACE FUNCTION public.ensure_login_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing text;
  v_code     text;
BEGIN
  SELECT login_code INTO v_existing FROM public.profiles WHERE user_id = p_user_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  LOOP
    v_code := LPAD((FLOOR(RANDOM() * 900000) + 100000)::bigint::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE login_code = v_code);
  END LOOP;

  UPDATE public.profiles SET login_code = v_code WHERE user_id = p_user_id;
  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_login_code(uuid) TO authenticated;

-- Also assign a login_code inside create_delegate_direct so direct-enrollment
-- students get their code immediately at account creation.
CREATE OR REPLACE FUNCTION public.create_delegate_direct(p_name text, p_login_id text, p_password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
    v_user_id    UUID := extensions.uuid_generate_v4();
    v_email      TEXT := lower(trim(p_login_id)) || '@yip-parliament.com';
    v_encrypted_pw TEXT;
    v_code       TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
        RETURN jsonb_build_object('success', false, 'error', 'This Delegate ID is already registered.');
    END IF;

    v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

    INSERT INTO auth.users (
        id, instance_id, email, encrypted_password,
        email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        aud, role, created_at, updated_at,
        is_super_admin, is_sso_user, is_anonymous,
        confirmation_token, email_change, email_change_token_new,
        recovery_token, email_change_token_current, phone_change_token,
        reauthentication_token
    ) VALUES (
        v_user_id, '00000000-0000-0000-0000-000000000000', v_email,
        v_encrypted_pw, now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', p_name),
        'authenticated', 'authenticated', now(), now(),
        false, false, false, '', '', '', '', '', '', ''
    );

    INSERT INTO auth.identities (
        id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at, provider_id
    ) VALUES (
        extensions.uuid_generate_v4(), v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
        'email', now(), now(), now(), v_user_id::text
    );

    -- Generate a unique 6-digit login code
    LOOP
      v_code := LPAD((FLOOR(RANDOM() * 900000) + 100000)::bigint::text, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE login_code = v_code);
    END LOOP;

    INSERT INTO public.profiles (
        user_id, name, user_type, position, is_active,
        party_number, serial_number, login_code
    ) VALUES (
        v_user_id, p_name, 'student', 'Member of Parliament', true,
        floor(random() * 5 + 1)::int,
        floor(random() * 9000 + 1000)::int,
        v_code
    );

    RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'login_code', v_code);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;
