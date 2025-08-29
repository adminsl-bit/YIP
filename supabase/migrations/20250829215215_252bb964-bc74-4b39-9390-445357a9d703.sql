-- Check if jury_leaderboard is a view
SELECT 
  schemaname, 
  viewname, 
  definition 
FROM pg_views 
WHERE schemaname = 'public' 
AND viewname = 'jury_leaderboard';