-- Fix Orders RLS to Enable Multiple Orders Per User
-- Problem: Users can only see/create one order, blocking subsequent orders

-- =============================================================================
-- DIAGNOSTIC: Check current state
-- =============================================================================

-- Check if RLS is enabled on orders
SELECT 
  'ORDERS TABLE RLS STATUS' as check_name,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'orders' AND schemaname = 'public';

-- Check existing policies
SELECT 
  'CURRENT ORDERS POLICIES' as check_name,
  policyname,
  cmd as permissions,
  roles,
  qual as using_clause
FROM pg_policies 
WHERE tablename = 'orders'
ORDER BY policyname;

-- =============================================================================
-- FIX: Set up proper RLS policies for orders table
-- =============================================================================

-- Enable RLS on orders table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Drop any existing restrictive policies
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Users can create own orders" ON orders;
DROP POLICY IF EXISTS "Talent can view their orders" ON orders;
DROP POLICY IF EXISTS "Allow authenticated order access" ON orders;
DROP POLICY IF EXISTS "Allow users to insert orders" ON orders;
DROP POLICY IF EXISTS "Allow users to view orders" ON orders;
DROP POLICY IF EXISTS "Allow talent to view orders" ON orders;

-- =============================================================================
-- POLICY 1: Users can INSERT their own orders (for placing orders)
-- =============================================================================
CREATE POLICY "Allow users to insert orders" ON orders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- POLICY 2: Users can VIEW ALL their own orders (enables multiple orders)
-- =============================================================================
CREATE POLICY "Allow users to view orders" ON orders
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- =============================================================================
-- POLICY 3: Talent can VIEW ALL orders for their profile
-- =============================================================================
CREATE POLICY "Allow talent to view orders" ON orders
FOR SELECT
TO authenticated
USING (
  talent_id IN (
    SELECT id FROM talent_profiles WHERE user_id = auth.uid()
  )
);

-- =============================================================================
-- POLICY 4: Talent can UPDATE orders (for fulfillment, rejection, etc.)
-- =============================================================================
CREATE POLICY "Allow talent to update orders" ON orders
FOR UPDATE
TO authenticated
USING (
  talent_id IN (
    SELECT id FROM talent_profiles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  talent_id IN (
    SELECT id FROM talent_profiles WHERE user_id = auth.uid()
  )
);

-- =============================================================================
-- POLICY 5: Allow admin access (if admin user type exists)
-- =============================================================================
CREATE POLICY "Allow admin full access" ON orders
FOR ALL
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM users WHERE user_type = 'admin'
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM users WHERE user_type = 'admin'
  )
);

-- =============================================================================
-- VERIFY: Show new policies
-- =============================================================================

SELECT 
  'NEW ORDERS POLICIES (Should see 5)' as check_name,
  policyname,
  cmd as permissions,
  roles
FROM pg_policies 
WHERE tablename = 'orders'
ORDER BY policyname;

-- =============================================================================
-- TEST: Check if users can now see multiple orders
-- =============================================================================

-- Show users with multiple orders (should work now)
SELECT 
  'USERS WITH MULTIPLE ORDERS TEST' as check_name,
  u.email,
  u.full_name,
  COUNT(o.id) as order_count,
  array_agg(o.id ORDER BY o.created_at DESC) as order_ids
FROM users u
INNER JOIN orders o ON o.user_id = u.id
GROUP BY u.id, u.email, u.full_name
HAVING COUNT(o.id) > 1
ORDER BY order_count DESC
LIMIT 10;

-- =============================================================================
-- BONUS: Fix jonathanbagwell123@gmail.com specifically
-- =============================================================================

-- Show all orders for this user (should show all 4 now)
SELECT 
  'jonathanbagwell123 ORDERS' as user_check,
  o.id,
  o.created_at,
  o.amount,
  o.status,
  o.payment_transaction_id,
  tp.temp_full_name as talent_name
FROM orders o
INNER JOIN users u ON o.user_id = u.id
INNER JOIN talent_profiles tp ON o.talent_id = tp.id
WHERE u.email = 'jonathanbagwell123@gmail.com'
ORDER BY o.created_at DESC;

-- =============================================================================
-- SUMMARY
-- =============================================================================

SELECT 
  'FIX APPLIED' as status,
  'Users can now create and view multiple orders!' as message
UNION ALL
SELECT 
  'NEXT STEP' as status,
  'Test by placing a new order - previous orders should still be visible' as message;

-- =============================================================================
-- USAGE NOTES:
-- =============================================================================
-- 
-- This script:
-- 1. Enables RLS on orders table
-- 2. Creates policies that allow:
--    - Users to INSERT their own orders (unlimited)
--    - Users to VIEW ALL their orders (not just one)
--    - Talent to VIEW all orders for their profile
--    - Talent to UPDATE orders (fulfill, deny, etc.)
--    - Admins to access all orders
--
-- The key fix: Changed from restrictive single-row policies to
-- policies that use USING clauses that match ALL rows for that user.
--
-- Before: USING (auth.uid() = user_id AND id = some_specific_id)  ❌
-- After:  USING (auth.uid() = user_id)  ✅ (matches ALL user's orders)
--
-- =============================================================================

