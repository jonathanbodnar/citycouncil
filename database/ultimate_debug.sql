-- ULTIMATE DEBUG: Show everything in result sets (no NOTICE needed)

-- 1. Does trigger exist?
SELECT 
  '1. TRIGGER CHECK' as step,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Trigger EXISTS'
    ELSE '❌ Trigger MISSING'
  END as status,
  STRING_AGG(tgname || ' (enabled: ' || tgenabled || ')', ', ') as details
FROM pg_trigger
WHERE tgname = 'on_talent_onboarded';

-- 2. Does function exist?
SELECT 
  '2. FUNCTION CHECK' as step,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Function EXISTS'
    ELSE '❌ Function MISSING'
  END as status,
  STRING_AGG(proname, ', ') as details
FROM pg_proc
WHERE proname = 'create_demo_order_for_talent';

-- 3. Testingauto details
SELECT 
  '3. TESTINGAUTO STATUS' as step,
  tp.full_name,
  tp.onboarding_completed,
  CASE 
    WHEN tp.id = ANY(ARRAY[
      (SELECT id FROM talent_profiles WHERE full_name = 'Nick Di Palo'),
      (SELECT id FROM talent_profiles WHERE full_name = 'Shawn Farash'),
      (SELECT id FROM talent_profiles WHERE full_name = 'Gerald Morgan')
    ]) THEN '❌ IS EXCLUDED'
    ELSE '✅ NOT EXCLUDED'
  END as exclusion_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM orders WHERE talent_id = tp.id AND order_type = 'demo')
    THEN '❌ Already has demo order'
    ELSE '✅ No demo order yet'
  END as demo_order_status
FROM talent_profiles tp
WHERE tp.full_name ILIKE '%testingauto%';

-- 4. Count orders by type for testingauto
SELECT 
  '4. ORDER COUNT BY TYPE' as step,
  o.order_type,
  COUNT(*) as count,
  STRING_AGG(o.id::text, ', ') as order_ids
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE tp.full_name ILIKE '%testingauto%'
GROUP BY o.order_type;

-- 5. Check if order_type column exists and has correct type
SELECT 
  '5. ORDER_TYPE COLUMN CHECK' as step,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Column EXISTS'
    ELSE '❌ Column MISSING'
  END as status,
  STRING_AGG(data_type, ', ') as data_type
FROM information_schema.columns
WHERE table_name = 'orders' 
AND column_name = 'order_type';

-- 6. Show ALL triggers on talent_profiles (to see if old ones exist)
SELECT 
  '6. ALL TRIGGERS ON TALENT_PROFILES' as step,
  tgname as trigger_name,
  tgenabled as enabled
FROM pg_trigger
WHERE tgrelid = 'talent_profiles'::regclass
ORDER BY tgname;

-- 7. Try to manually create a demo order for testingauto
INSERT INTO orders (
  id,
  user_id,
  talent_id,
  request_details,
  order_type,
  amount,
  admin_fee,
  status,
  fulfillment_deadline,
  payment_transaction_id,
  is_corporate,
  is_corporate_order,
  approval_status,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  (SELECT gen_random_uuid()), -- temp user
  tp.id,
  'TEST: Manual demo order creation',
  'demo',
  1, -- $0.01
  0,
  'pending',
  NOW() + INTERVAL '48 hours',
  'MANUAL_DEMO_' || tp.id,
  false,
  false,
  'approved',
  NOW(),
  NOW()
FROM talent_profiles tp
WHERE tp.full_name ILIKE '%testingauto%'
AND NOT EXISTS (SELECT 1 FROM orders WHERE talent_id = tp.id AND order_type = 'demo')
LIMIT 1
RETURNING 
  '7. MANUAL DEMO ORDER CREATION' as step,
  '✅ Created demo order manually' as status,
  id as order_id,
  order_type,
  amount;

-- 8. Final order list for testingauto
SELECT 
  '8. ALL ORDERS FOR TESTINGAUTO' as step,
  o.id,
  o.order_type,
  o.amount,
  LEFT(o.request_details, 50) as request_preview,
  o.created_at
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE tp.full_name ILIKE '%testingauto%'
ORDER BY o.created_at DESC;

