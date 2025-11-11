-- Quick verification that all fixes are in place

-- 1. Check order_type column exists
SELECT 
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns
WHERE table_name = 'orders' 
  AND column_name = 'order_type';

-- 2. Check the demo order trigger function exists and is updated
SELECT 
  routine_name,
  routine_type,
  CASE 
    WHEN routine_definition LIKE '%ON CONFLICT%' THEN '❌ Still has ON CONFLICT (BAD)'
    WHEN routine_definition LIKE '%SELECT id INTO demo_user_id%' THEN '✅ Fixed - uses SELECT before INSERT'
    ELSE '⚠️ Unknown state'
  END as status
FROM information_schema.routines
WHERE routine_name = 'create_demo_order_for_talent';

-- 3. Check demo order tables exist
SELECT 
  table_name,
  '✅ Exists' as status
FROM information_schema.tables
WHERE table_name IN ('demo_order_requests', 'demo_customer_names')
ORDER BY table_name;

-- 4. Check if we have any demo orders yet
SELECT 
  COUNT(*) as total_demo_orders,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_demo_orders
FROM orders
WHERE order_type = 'demo';

SELECT '✅ All verification checks complete!' as result;

