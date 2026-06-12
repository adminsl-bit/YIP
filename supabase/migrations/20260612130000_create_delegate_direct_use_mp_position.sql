-- Self-registered candidates (via /register) were tagged with position
-- 'Delegate', an inconsistent value not used anywhere else in the app
-- (StudentEditDialog/StudentBulkImport use 'Member of Parliament'). This
-- required a special-case normalization in OrganizerLeaderboard and caused
-- mismatched counts/labels elsewhere. Tag new self-registrations as
-- 'Member of Parliament' instead, and backfill any existing 'Delegate' rows.

CREATE OR REPLACE FUNCTION public.create_delegate_direct(p_name text, p_login_id text, p_password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
    v_user_id UUID := extensions.uuid_generate_v4();
    v_email TEXT := lower(trim(p_login_id)) || '@yip-parliament.com';
    v_encrypted_pw TEXT;
BEGIN
    -- 1. Check if user already exists (sanity check)
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
        RETURN jsonb_build_object('success', false, 'error', 'This Delegate ID is already registered.');
    END IF;

    -- 2. Encrypt password using pgcrypto
    v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

    -- 3. Create the Auth record
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
        v_encrypted_pw,
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', p_name),
        'authenticated', 'authenticated', now(), now(),
        false, false, false,
        '', '', '',
        '', '', '',
        ''
    );

    -- 4. Create the Identity record (critical for login)
    INSERT INTO auth.identities (
        id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at,
        provider_id
    ) VALUES (
        extensions.uuid_generate_v4(), v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
        'email', now(), now(), now(),
        v_user_id::text
    );

    -- 5. Create the Profile
    INSERT INTO public.profiles (
        user_id, name, user_type, position, is_active,
        party_number, serial_number
    ) VALUES (
        v_user_id, p_name, 'student', 'Member of Parliament', true,
        floor(random() * 5 + 1)::int,
        floor(random() * 9000 + 1000)::int
    );

    RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Backfill any profiles previously tagged 'Delegate' to the canonical value.
UPDATE public.profiles SET position = 'Member of Parliament' WHERE position = 'Delegate';
