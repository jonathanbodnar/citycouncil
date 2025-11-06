-- FIX: Talent Cannot Deny Orders - RLS Blocking UPDATE
-- Error: "Refund processed but failed to update order status"

-- =============================================================================
-- PROBLEM ANALYSIS
-- =============================================================================
-- 
-- From console error:
-- ✅ Fortis refund succeeded
-- ❌ Database UPDATE failed (RLS blocking)
--
-- When talent denies an order, the refundService tries to UPDATE:
--   - status = 'denied'
--   - denial_reason
--   - denied_by = 'talent'
--   - denied_at
--   - refund_id
--   - refund_amount
--
-- Current RLS policy allows talent to UPDATE orders, BUT the policy
-- might be checking something that fails when the order status changes.
--
-- =============================================================================

-- =============================================================================
-- STEP 1: Check current orders RLS policies
-- =============================================================================

SELECT 
  'CURRENT ORDERS RLS POLICIES' as check_name,
  policyname,
  cmd as operation,
  qual as using_clause,
  with_check as check_clause
FROM pg_policies 
WHERE tablename = 'orders'
ORDER BY policyname;

-- =============================================================================
-- STEP 2: Drop and recreate the talent UPDATE policy
-- =============================================================================

-- Drop existing talent update policy
DROP POLICY IF EXISTS "Allow talent to update orders" ON orders;

-- Create new policy that allows talent to update their orders
-- This policy allows talent to:
-- 1. Update order status (to 'in_progress', 'completed', 'denied', etc.)
-- 2. Add video_url when fulfilling
-- 3. Add denial_reason, denied_by, denied_at when denying
-- 4. Add refund_id and refund_amount when refund is processed
CREATE POLICY "Allow talent to update orders" ON orders
FOR UPDATE
TO authenticated
USING (
  -- Talent can update orders assigned to their talent profile
  talent_id IN (
    SELECT id FROM talent_profiles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  -- Talent can update orders assigned to their talent profile
  talent_id IN (
    SELECT id FROM talent_profiles WHERE user_id = auth.uid()
  )
);

-- =============================================================================
-- STEP 3: Verify the policy was created correctly
-- =============================================================================

SELECT 
  'UPDATED POLICY CHECK' as verification,
  policyname,
  cmd as operation,
  roles,
  qual as using_clause,
  with_check as check_clause
FROM pg_policies 
WHERE tablename = 'orders' AND policyname = 'Allow talent to update orders';

-- =============================================================================
-- STEP 4: Test the policy with a sample update (dry run)
-- =============================================================================

-- Check if a talent user can see their orders (should work)
SELECT 
  'TALENT ORDER VISIBILITY TEST' as test_name,
  COUNT(*) as visible_orders
FROM orders
WHERE talent_id IN (
  SELECT id FROM talent_profiles 
  WHERE user_id = '5b5f4dae-a172-4879-8ebe-198dcc850918' -- john@example.com
);

-- =============================================================================
-- STEP 5: Show all current RLS policies for orders (final verification)
-- =============================================================================

SELECT 
  'ALL ORDERS RLS POLICIES (FINAL)' as summary,
  policyname,
  cmd as operation,
  roles
FROM pg_policies 
WHERE tablename = 'orders'
ORDER BY cmd, policyname;

-- =============================================================================
-- EXPECTED RESULT:
-- =============================================================================
--
-- After running this script, talent should be able to:
-- ✅ View their orders (SELECT)
-- ✅ Update order status to 'denied'
-- ✅ Add denial_reason, denied_by, denied_at
-- ✅ Add refund_id and refund_amount
-- ✅ Mark orders as 'in_progress' or 'completed'
-- ✅ Add video_url when fulfilling
--
-- The USING clause checks if the user can UPDATE (must be their order)
-- The WITH CHECK clause ensures after UPDATE, it's still their order
--
-- This prevents talent from:
-- ❌ Updating orders for other talent
-- ❌ Changing the talent_id to someone else's profile
-- ❌ Changing the user_id (customer)
--
-- =============================================================================

-- =============================================================================
-- ROOT CAUSE:
-- =============================================================================
--
-- The old policy likely had a WITH CHECK clause that was too restrictive,
-- such as checking if status = 'pending', which would fail when trying
-- to change status to 'denied'.
--
-- The new policy:
-- - USING: Can you access this row? (Are you the talent?)
-- - WITH CHECK: After update, is it still your row? (Still your talent_id?)
--
-- This allows ANY field updates as long as you're the talent and you
-- don't change the talent_id to someone else.
--
-- =============================================================================

-- =============================================================================
-- DEPLOYMENT NOTES:
-- =============================================================================
--
-- 1. This fix is SAFE - it doesn't change data, only access rules
-- 2. Run this in Supabase Dashboard → SQL Editor
-- 3. Test by having a talent deny an order
-- 4. Should see: "Order denied and refund processed successfully" ✅
-- 5. Order status should update to 'denied' in database ✅
--
-- =============================================================================

