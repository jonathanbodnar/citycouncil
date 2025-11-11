-- Find ALL triggers that might be causing the ON CONFLICT error

-- 1. List all triggers on talent_profiles table
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'talent_profiles'
ORDER BY trigger_name;

-- 2. Show the FULL definition of create_demo_order_for_talent function
SELECT routine_definition
FROM information_schema.routines
WHERE routine_name = 'create_demo_order_for_talent';

-- 3. Check if there are ANY functions using ON CONFLICT with email
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_definition LIKE '%ON CONFLICT%email%'
  AND routine_schema = 'public';

-- 4. List all triggers that fire on UPDATE
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_manipulation = 'UPDATE'
  AND event_object_schema = 'public'
ORDER BY event_object_table, trigger_name;

