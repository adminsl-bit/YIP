-- Assign admin_student role to all users with Administrator position
INSERT INTO public.user_roles (user_id, role, created_by)
SELECT user_id, 'admin_student'::app_role, user_id
FROM public.profiles 
WHERE position = 'Administrator'
ON CONFLICT (user_id, role) DO NOTHING;