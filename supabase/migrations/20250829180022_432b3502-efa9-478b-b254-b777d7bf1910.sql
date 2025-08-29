-- Fix remaining function search paths
ALTER FUNCTION public.get_current_user_type() SET search_path = 'public';
ALTER FUNCTION public.update_updated_at_column() SET search_path = 'public';
ALTER FUNCTION public.create_user_profile(uuid, integer, text, text, integer, text, text, text) SET search_path = 'public';
ALTER FUNCTION public.log_user_login(uuid, text, text, text) SET search_path = 'public';
ALTER FUNCTION public.calculate_total_score(jsonb) SET search_path = 'public';
ALTER FUNCTION public.log_audit_event(uuid, text, text, text, jsonb, text, text) SET search_path = 'public';