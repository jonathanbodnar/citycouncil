-- Debug script for testingauto talent

-- 1. Check if talent exists and onboarding status
SELECT 
  id,
  user_id,
  full_name,
  onboarding_completed,
  created_at,
  updated_at
FROM talent_profiles
WHERE full_name ILIKE '%testingauto%'
ORDER BY created_at DESC;

-- 2. Check if any demo orders exist for this talent
SELECT 
  o.id,
  o.talent_id,
  o.order_type,
  o.amount,
  o.status,
  o.created_at,
  tp.full_name as talent_name
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE tp.full_name ILIKE '%testingauto%';

-- 3. Check if trigger exists and is enabled
SELECT 
  tgname as trigger_name,
  tgtype,
  tgenabled as enabled,
  tgrelid::regclass as table_name
FROM pg_trigger
WHERE tgname = 'on_talent_onboarded';

-- 4. Check if the trigger function exists
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
WHERE p.proname = 'create_demo_order_for_talent';

-- 5. Check for any errors in PostgreSQL logs (if accessible)
-- This might not return results depending on permissions
SELECT * FROM pg_stat_statements 
WHERE query LIKE '%create_demo_order%' 
ORDER BY calls DESC 
LIMIT 5;

