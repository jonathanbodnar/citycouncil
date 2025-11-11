-- Complete diagnostic for demo order trigger

-- 1. Check testingauto talent details
SELECT 
  'Talent Details' as check_type,
  id,
  user_id,
  full_name,
  onboarding_completed,
  created_at,
  updated_at
FROM talent_profiles
WHERE full_name ILIKE '%testingauto%';

-- 2. Check if demo orders exist for testingauto
SELECT 
  'Demo Orders' as check_type,
  o.id,
  o.talent_id,
  o.order_type,
  o.amount,
  o.status,
  o.created_at
FROM orders o
WHERE o.talent_id = (SELECT id FROM talent_profiles WHERE full_name ILIKE '%testingauto%' LIMIT 1);

-- 3. Check ALL triggers on talent_profiles
SELECT 
  'All Triggers on talent_profiles' as check_type,
  tgname as trigger_name,
  tgtype,
  tgenabled as enabled,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgrelid = 'talent_profiles'::regclass
ORDER BY tgname;

-- 4. Check if the function exists and is correct
SELECT 
  'Trigger Function' as check_type,
  proname as function_name,
  pronargs as num_args,
  prorettype::regtype as return_type
FROM pg_proc
WHERE proname = 'create_demo_order_for_talent';

-- 5. Check excluded talent IDs
SELECT 
  'Excluded Talents' as check_type,
  id,
  full_name
FROM talent_profiles
WHERE full_name IN ('Nick Di Palo', 'Shawn Farash', 'Gerald Morgan');

-- 6. Test the trigger condition manually
SELECT 
  'Trigger Condition Test' as check_type,
  tp.id,
  tp.full_name,
  tp.onboarding_completed,
  tp.id = ANY(ARRAY[
    (SELECT id FROM talent_profiles WHERE full_name = 'Nick Di Palo'),
    (SELECT id FROM talent_profiles WHERE full_name = 'Shawn Farash'),
    (SELECT id FROM talent_profiles WHERE full_name = 'Gerald Morgan')
  ]) as is_excluded,
  EXISTS (
    SELECT 1 FROM orders 
    WHERE talent_id = tp.id 
    AND order_type = 'demo'
  ) as has_demo_order
FROM talent_profiles tp
WHERE tp.full_name ILIKE '%testingauto%';

-- 7. Check order_type column exists
SELECT 
  'Order Type Column' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'orders' 
AND column_name = 'order_type';

-- 8. Enable notices to see trigger logs
SET client_min_messages = NOTICE;

-- 9. Try to manually fire the trigger
DO $$
DECLARE
  testing_talent_id UUID;
BEGIN
  -- Get testingauto talent ID
  SELECT id INTO testing_talent_id
  FROM talent_profiles
  WHERE full_name ILIKE '%testingauto%'
  LIMIT 1;
  
  IF testing_talent_id IS NOT NULL THEN
    -- Set to false first
    UPDATE talent_profiles 
    SET onboarding_completed = false 
    WHERE id = testing_talent_id;
    
    RAISE NOTICE 'Set onboarding_completed to false for testingauto';
    
    -- Set to true to trigger
    UPDATE talent_profiles 
    SET onboarding_completed = true 
    WHERE id = testing_talent_id;
    
    RAISE NOTICE 'Set onboarding_completed to true for testingauto - trigger should fire';
  ELSE
    RAISE NOTICE 'Could not find testingauto talent';
  END IF;
END $$;

-- 10. Check if demo order was created after manual trigger
SELECT 
  'Demo Order After Manual Trigger' as check_type,
  o.id,
  o.talent_id,
  o.user_id,
  o.order_type,
  o.amount,
  o.status,
  o.request_details,
  o.created_at,
  tp.full_name as talent_name
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE tp.full_name ILIKE '%testingauto%'
ORDER BY o.created_at DESC;

-- 11. Check notifications for testingauto
SELECT 
  'Notifications' as check_type,
  n.id,
  n.user_id,
  n.type,
  n.title,
  n.message,
  n.order_id,
  n.created_at,
  u.full_name as user_name
FROM notifications n
JOIN users u ON u.id = n.user_id
WHERE u.id = (SELECT user_id FROM talent_profiles WHERE full_name ILIKE '%testingauto%' LIMIT 1)
ORDER BY n.created_at DESC;

