-- Check for Security Definer views more thoroughly
SELECT 
  schemaname,
  viewname,
  definition
FROM pg_views 
WHERE schemaname = 'public'
  AND definition ILIKE '%SECURITY DEFINER%';