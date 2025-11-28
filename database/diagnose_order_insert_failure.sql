-- Comprehensive diagnosis of why Mark Walker's order insert failed
-- Email: trainleader21@gmail.com
-- Talent: Gerald Morgan

-- ===== 1. CHECK USER ACCOUNT STATUS =====
SELECT 
  'USER ACCOUNT CHECK' as check_type,
  id,
  email,
  phone,
  full_name,
  user_type,
  created_at,
  last_login,
  CASE 
    WHEN id IS NULL THEN '❌ User does not exist'
    WHEN user_type != 'user' THEN '⚠️ Wrong user type: ' || user_type
    WHEN phone IS NULL THEN '⚠️ Phone is NULL (may cause issues)'
    ELSE '✅ User account OK'
  END as status
FROM public.users
WHERE email = 'trainleader21@gmail.com';

-- ===== 2. CHECK GERALD MORGAN'S TALENT PROFILE =====
SELECT 
  'TALENT PROFILE CHECK' as check_type,
  id,
  temp_full_name,
  pricing,
  is_active,
  user_id,
  CASE 
    WHEN id IS NULL THEN '❌ Talent does not exist'
    WHEN is_active = false THEN '❌ Talent is INACTIVE'
    WHEN user_id IS NULL THEN '⚠️ No user_id linked'
    WHEN pricing IS NULL OR pricing = 0 THEN '⚠️ No pricing set'
    ELSE '✅ Talent profile OK'
  END as status
FROM talent_profiles
WHERE temp_full_name ILIKE '%gerald%morgan%';

-- ===== 3. CHECK RLS POLICIES ON ORDERS TABLE =====
SELECT 
  'RLS POLICY CHECK' as check_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'orders'
ORDER BY cmd, policyname;

-- ===== 4. CHECK IF RLS IS ENABLED =====
SELECT 
  'RLS STATUS CHECK' as check_type,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'orders';

-- ===== 5. CHECK TABLE CONSTRAINTS =====
SELECT 
  'CONSTRAINTS CHECK' as check_type,
  conname as constraint_name,
  contype as constraint_type,
  CASE contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'c' THEN 'CHECK'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'x' THEN 'EXCLUSION'
    ELSE contype::text
  END as type_description,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'orders'::regclass
ORDER BY contype;

-- ===== 6. CHECK COLUMN DEFINITIONS =====
SELECT 
  'COLUMN TYPE CHECK' as check_type,
  column_name,
  data_type,
  is_nullable,
  column_default,
  CASE 
    WHEN column_name IN ('amount', 'admin_fee', 'charity_amount') AND data_type != 'integer' AND data_type != 'bigint' 
    THEN '⚠️ Should be INTEGER/BIGINT for cents'
    WHEN is_nullable = 'NO' AND column_default IS NULL 
    THEN '⚠️ NOT NULL without default'
    ELSE '✅ OK'
  END as status
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name IN (
    'user_id', 'talent_id', 'amount', 'admin_fee', 'charity_amount',
    'fulfillment_deadline', 'status', 'payment_transaction_id'
  )
ORDER BY ordinal_position;

-- ===== 7. TEST INSERT PERMISSIONS =====
-- Try to see what roles can insert
SELECT 
  'INSERT PERMISSIONS CHECK' as check_type,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'orders'
  AND privilege_type = 'INSERT';

-- ===== 8. CHECK FOR TRIGGERS THAT MIGHT FAIL =====
SELECT 
  'TRIGGERS CHECK' as check_type,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'orders'
ORDER BY action_timing, trigger_name;

-- ===== 9. CHECK RECENT ORDER PATTERNS =====
SELECT 
  'RECENT ORDERS PATTERN' as check_type,
  COUNT(*) as total_orders,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(created_at) as oldest_order,
  MAX(created_at) as newest_order,
  AVG(amount / 100.0) as avg_amount_dollars
FROM orders
WHERE created_at > NOW() - INTERVAL '7 days';

-- ===== 10. CHECK FOR NULL REQUIRED FIELDS IN RECENT ORDERS =====
SELECT 
  'NULL FIELDS IN RECENT ORDERS' as check_type,
  COUNT(*) as total_orders,
  COUNT(*) FILTER (WHERE user_id IS NULL) as missing_user_id,
  COUNT(*) FILTER (WHERE talent_id IS NULL) as missing_talent_id,
  COUNT(*) FILTER (WHERE amount IS NULL) as missing_amount,
  COUNT(*) FILTER (WHERE status IS NULL) as missing_status,
  COUNT(*) FILTER (WHERE fulfillment_deadline IS NULL) as missing_deadline
FROM orders
WHERE created_at > NOW() - INTERVAL '7 days';

