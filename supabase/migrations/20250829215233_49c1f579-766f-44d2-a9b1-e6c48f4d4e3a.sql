-- Fix the remaining security issues

-- 1. Drop and recreate the jury_leaderboard view without SECURITY DEFINER if it exists
-- First check for any SECURITY DEFINER views
SELECT 
  n.nspname AS schema_name,
  c.relname AS view_name,
  CASE 
    WHEN c.relkind = 'v' THEN 'view'
    WHEN c.relkind = 'r' THEN 'table'
    ELSE 'other'
  END AS object_type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'v'
  AND EXISTS (
    SELECT 1 FROM pg_rewrite r
    WHERE r.ev_class = c.oid
      AND r.ev_action::text LIKE '%SECURITY DEFINER%'
  );