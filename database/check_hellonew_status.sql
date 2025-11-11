-- Check hellonew status and why demo order wasn't created

-- 1. Find hellonew talent profile
SELECT 
  id,
  full_name,
  user_id,
  onboarding_completed,
  is_active,
  created_at
FROM talent_profiles
WHERE full_name ILIKE '%hellonew%';

-- 2. Check if any demo orders exist for hellonew
SELECT 
  o.id,
  o.order_type,
  o.status,
  o.created_at
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE tp.full_name ILIKE '%hellonew%'
  AND o.order_type = 'demo';

-- 3. Check if there are ANY existing users to use as demo customer
SELECT 
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE user_type = 'user') as regular_users,
  COUNT(*) FILTER (WHERE user_type = 'talent') as talent_users
FROM users;

-- 4. Check if hellonew is in the exclusion list
WITH hellonew_talent AS (
  SELECT id, full_name FROM talent_profiles WHERE full_name ILIKE '%hellonew%' LIMIT 1
),
excluded_ids AS (
  SELECT id FROM talent_profiles 
  WHERE full_name IN ('Nick Di Palo', 'Shawn Farash', 'Gerald Morgan')
)
SELECT 
  ht.id,
  ht.full_name,
  CASE 
    WHEN ht.id IN (SELECT id FROM excluded_ids) THEN '❌ EXCLUDED'
    ELSE '✅ Should get demo order'
  END as status
FROM hellonew_talent ht;

-- 5. Show the trigger definition to verify it's correct
SELECT 
  trigger_name,
  event_object_table,
  action_statement,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'on_talent_onboarded';

