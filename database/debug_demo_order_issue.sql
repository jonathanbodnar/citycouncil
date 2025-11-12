-- Debug script to check why demo order isn't being created

-- 1. Check if trigger exists and is enabled
SELECT 
  tgname AS trigger_name,
  tgenabled AS enabled,
  pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgname LIKE '%demo%'
ORDER BY tgname;

-- 2. Check if function exists
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname LIKE '%demo%';

-- 3. Check the most recent talent that completed onboarding
SELECT 
  id,
  full_name,
  username,
  onboarding_completed,
  created_at,
  updated_at
FROM talent_profiles
WHERE onboarding_completed = true
ORDER BY updated_at DESC
LIMIT 5;

-- 4. Check if any demo orders exist for recent talent
SELECT 
  o.id,
  o.talent_id,
  o.order_type,
  o.created_at,
  t.full_name AS talent_name,
  t.username
FROM orders o
JOIN talent_profiles t ON o.talent_id = t.id
WHERE o.order_type = 'demo'
ORDER BY o.created_at DESC
LIMIT 10;

-- 5. Check excluded talent IDs
SELECT id, full_name 
FROM talent_profiles 
WHERE full_name IN ('Nick Di Palo', 'Shawn Farash', 'Gerald Morgan');

-- 6. For a specific talent, check if they should get a demo order
-- Replace 'USERNAME_HERE' with the actual username
WITH target_talent AS (
  SELECT id, full_name, username, onboarding_completed
  FROM talent_profiles
  WHERE username = 'USERNAME_HERE' -- REPLACE THIS
)
SELECT 
  t.*,
  CASE 
    WHEN t.onboarding_completed = false THEN 'Not completed onboarding'
    WHEN EXISTS (SELECT 1 FROM orders WHERE talent_id = t.id AND order_type = 'demo') THEN 'Demo order already exists'
    WHEN t.full_name IN ('Nick Di Palo', 'Shawn Farash', 'Gerald Morgan') THEN 'Excluded talent'
    ELSE 'Should have demo order - ISSUE!'
  END AS status,
  (SELECT COUNT(*) FROM orders WHERE talent_id = t.id AND order_type = 'demo') AS demo_order_count
FROM target_talent t;

