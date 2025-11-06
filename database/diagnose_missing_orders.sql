-- Diagnose Missing Orders Issue
-- Problem: Fortis processes payment but orders don't appear in database

-- =============================================================================
-- CHECK 1: Look for recent Fortis transactions that don't have orders
-- =============================================================================

-- Show recent orders with transaction IDs
SELECT 
  'RECENT ORDERS IN DATABASE' as check_name,
  o.id as order_id,
  o.user_id,
  o.talent_id,
  o.payment_transaction_id as fortis_transaction_id,
  o.amount,
  o.status,
  o.created_at,
  u.email as customer_email
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
WHERE o.created_at > NOW() - INTERVAL '7 days'
ORDER BY o.created_at DESC
LIMIT 20;

-- =============================================================================
-- CHECK 2: Are there RLS policies blocking order inserts?
-- =============================================================================

SELECT 
  'RLS POLICIES ON ORDERS TABLE' as check_name,
  policyname,
  cmd as permissions,
  roles,
  qual as using_clause
FROM pg_policies 
WHERE tablename = 'orders'
ORDER BY policyname;

-- =============================================================================
-- CHECK 3: Check if orders table has all required columns
-- =============================================================================

SELECT 
  'ORDERS TABLE STRUCTURE' as check_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'orders' AND table_schema = 'public'
ORDER BY ordinal_position;

-- =============================================================================
-- CHECK 4: Are there constraints/triggers that might block inserts?
-- =============================================================================

SELECT 
  'CONSTRAINTS ON ORDERS TABLE' as check_name,
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.orders'::regclass;

-- =============================================================================
-- CHECK 5: Look for users with payments but no orders
-- =============================================================================

-- This checks for users who might have been charged but order didn't save
SELECT 
  'USERS WITH FEW/NO ORDERS' as check_name,
  u.id,
  u.email,
  u.full_name,
  u.created_at as user_created,
  COUNT(o.id) as total_orders,
  MAX(o.created_at) as last_order_date
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.user_type = 'user'
  AND u.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.id, u.email, u.full_name, u.created_at
HAVING COUNT(o.id) < 2
ORDER BY u.created_at DESC
LIMIT 20;

-- =============================================================================
-- CHECK 6: Test if we can manually insert an order
-- =============================================================================

DO $$
DECLARE
  test_user_id uuid;
  test_talent_id uuid;
  test_order_id uuid;
BEGIN
  -- Get a real user and talent for testing
  SELECT id INTO test_user_id FROM users WHERE user_type = 'user' LIMIT 1;
  SELECT id INTO test_talent_id FROM talent_profiles LIMIT 1;
  
  IF test_user_id IS NULL OR test_talent_id IS NULL THEN
    RAISE NOTICE '⚠️ Cannot test: No users or talent found';
    RETURN;
  END IF;
  
  -- Try to insert a test order
  INSERT INTO orders (
    user_id,
    talent_id,
    request_details,
    amount,
    status,
    payment_transaction_id,
    fulfillment_deadline
  ) VALUES (
    test_user_id,
    test_talent_id,
    'TEST ORDER - SHOULD BE DELETED',
    299.99,
    'pending',
    'TEST-' || floor(random() * 100000)::text,
    NOW() + INTERVAL '48 hours'
  )
  RETURNING id INTO test_order_id;
  
  -- If we got here, insert worked!
  RAISE NOTICE '✓ TEST PASSED: Order insert works (order_id: %)', test_order_id;
  
  -- Clean up test order
  DELETE FROM orders WHERE id = test_order_id;
  RAISE NOTICE '✓ Test order cleaned up';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ TEST FAILED: Cannot insert order - Error: %', SQLERRM;
END $$;

-- =============================================================================
-- CHECK 7: Look for duplicate prevention logic
-- =============================================================================

-- Check if there's a unique constraint on payment_transaction_id
SELECT 
  'UNIQUE CONSTRAINTS' as check_name,
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.orders'::regclass
  AND contype = 'u'  -- unique constraints
ORDER BY conname;

-- =============================================================================
-- POTENTIAL ISSUES TO CHECK:
-- =============================================================================

-- 1. RLS Policy blocking authenticated users from inserting orders
-- 2. Missing required columns (NOT NULL constraints)
-- 3. Foreign key constraints failing (invalid user_id or talent_id)
-- 4. Unique constraint on payment_transaction_id preventing duplicate orders
-- 5. Application error not being caught/logged properly

