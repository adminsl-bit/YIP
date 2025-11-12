-- Enable RLS on the organizer_manual_scoring view
ALTER VIEW public.organizer_manual_scoring SET (security_invoker = true);

-- Grant select permission to authenticated users
GRANT SELECT ON public.organizer_manual_scoring TO authenticated;