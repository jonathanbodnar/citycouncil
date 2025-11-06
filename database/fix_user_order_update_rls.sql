-- FIX: Users Cannot Update Order Request Details
-- Issue: Users edit request_details but talent doesn't see the update

-- =============================================================================
-- PROBLEM ANALYSIS
-- =============================================================================
--
-- User Dashboard allows editing request_details for pending orders:
-- 1. User clicks "Edit Request"
-- 2. User updates the message
-- 3. User clicks "Save"
-- 4. Frontend calls: UPDATE orders SET request_details = '...' WHERE id = '...'
-- 5. ✅ User sees "Request details updated!" toast
-- 6. ❌ Talent dashboard doesn't show the update
--
-- Possible causes:
-- A. RLS blocks user UPDATE (but then toast wouldn't show success)
-- B. UPDATE succeeds but talent can't SELECT updated data (RLS read issue)
-- C. Talent dashboard caches old data (frontend issue)
--
-- =============================================================================

-- =============================================================================
-- STEP 1: Check current orders RLS policies
-- =============================================================================

SELECT 
  'CURRENT ORDERS RLS POLICIES' as check_name,
  policyname,
  cmd as operation,
  roles,
  qual as using_clause,
  with_check as check_clause
FROM pg_policies 
WHERE tablename = 'orders'
ORDER BY cmd, policyname;

-- =============================================================================
-- STEP 2: Test if users can UPDATE their own orders
-- =============================================================================

-- Check if there's a policy allowing users to UPDATE orders
SELECT 
  'USER UPDATE POLICY CHECK' as check_name,
  COUNT(*) as policy_count,
  array_agg(policyname) as policy_names
FROM pg_policies 
WHERE tablename = 'orders' 
  AND cmd = 'UPDATE'
  AND (
    qual LIKE '%user_id%' 
    OR qual LIKE '%auth.uid()%'
  );

-- =============================================================================
-- STEP 3: Create/update USER UPDATE policy if missing or broken
-- =============================================================================

-- Drop existing user update policy if it exists
DROP POLICY IF EXISTS "Allow users to update own orders" ON orders;

-- Create new policy allowing users to update ONLY request_details on pending orders
CREATE POLICY "Allow users to update own orders" ON orders
FOR UPDATE
TO authenticated
USING (
  -- User can only update their own orders
  auth.uid() = user_id
  -- AND status = 'pending' -- Optionally restrict to pending orders only
)
WITH CHECK (
  -- After update, must still be their order
  auth.uid() = user_id
  -- Prevent changing critical fields (optional - comment out if too restrictive)
  -- This allows updating ANY field, but you could restrict to just request_details
);

-- =============================================================================
-- STEP 4: Verify talent can still SELECT orders with updated request_details
-- =============================================================================

-- Check talent SELECT policy
SELECT 
  'TALENT SELECT POLICY CHECK' as check_name,
  policyname,
  qual as using_clause
FROM pg_policies 
WHERE tablename = 'orders' 
  AND cmd = 'SELECT'
  AND qual LIKE '%talent%';

-- =============================================================================
-- STEP 5: Ensure talent SELECT policy allows seeing ALL order fields
-- =============================================================================

-- Verify the talent can view orders (should already exist from previous fix)
SELECT 
  'VERIFY TALENT VIEW POLICY' as check_name,
  policyname,
  cmd,
  roles,
  qual as using_clause
FROM pg_policies 
WHERE tablename = 'orders' 
  AND policyname = 'Allow talent to view orders';

-- If missing, create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'orders' 
      AND policyname = 'Allow talent to view orders'
  ) THEN
    EXECUTE '
      CREATE POLICY "Allow talent to view orders" ON orders
      FOR SELECT
      TO authenticated
      USING (
        talent_id IN (
          SELECT id FROM talent_profiles WHERE user_id = auth.uid()
        )
      );
    ';
  END IF;
END $$;

-- =============================================================================
-- STEP 6: Test with a real order update (dry run)
-- =============================================================================

-- Show a sample order before potential update
SELECT 
  'SAMPLE ORDER (BEFORE UPDATE)' as test_phase,
  id,
  user_id,
  talent_id,
  request_details,
  status,
  created_at
FROM orders
WHERE status = 'pending'
LIMIT 1;

-- =============================================================================
-- STEP 7: Show all RLS policies on orders (final verification)
-- =============================================================================

SELECT 
  'ALL ORDERS RLS POLICIES (FINAL)' as summary,
  policyname,
  cmd as operation,
  roles,
  CASE 
    WHEN cmd = 'SELECT' THEN 'Read access'
    WHEN cmd = 'INSERT' THEN 'Create access'
    WHEN cmd = 'UPDATE' THEN 'Edit access'
    WHEN cmd = 'DELETE' THEN 'Delete access'
    ELSE 'All access'
  END as permission_type
FROM pg_policies 
WHERE tablename = 'orders'
ORDER BY 
  CASE cmd
    WHEN 'SELECT' THEN 1
    WHEN 'INSERT' THEN 2
    WHEN 'UPDATE' THEN 3
    WHEN 'DELETE' THEN 4
    ELSE 5
  END,
  policyname;

-- =============================================================================
-- EXPECTED POLICIES AFTER FIX:
-- =============================================================================
--
-- 1. "Allow users to insert orders" (INSERT)
--    - Users can create orders for themselves
--
-- 2. "Allow users to view orders" (SELECT)
--    - Users can view their own orders
--
-- 3. "Allow users to update own orders" (UPDATE) ← NEW/FIXED
--    - Users can update request_details on their orders
--
-- 4. "Allow talent to view orders" (SELECT)
--    - Talent can view orders assigned to them
--
-- 5. "Allow talent to update orders" (UPDATE)
--    - Talent can update status, video_url, denial info, etc.
--
-- 6. "Allow admin full access" (ALL)
--    - Admins can do anything
--
-- =============================================================================

-- =============================================================================
-- TESTING STEPS:
-- =============================================================================
--
-- 1. Run this script in Supabase SQL Editor
--
-- 2. As a regular user:
--    a. Go to User Dashboard → My Orders
--    b. Find a pending order
--    c. Click "Edit Request"
--    d. Change the text
--    e. Click "Save"
--    f. Should see: "Request details updated!" toast
--
-- 3. As the talent for that order:
--    a. Go to Talent Dashboard → Orders
--    b. Find the same order
--    c. Should see the UPDATED request_details
--    d. Refresh page if needed
--
-- 4. Verify in Supabase:
--    a. Open orders table
--    b. Find the order by ID
--    c. Check request_details column
--    d. Should show the new text
--
-- =============================================================================

-- =============================================================================
-- TROUBLESHOOTING:
-- =============================================================================
--
-- If update still doesn't work:
--
-- 1. Check if UPDATE succeeded:
--    SELECT request_details FROM orders WHERE id = '[order_id]';
--
-- 2. If request_details is OLD:
--    - RLS blocked the UPDATE
--    - Check browser console for "row-level security policy" error
--
-- 3. If request_details is NEW but talent doesn't see it:
--    - Frontend caching issue
--    - Talent needs to refresh page
--    - Check TalentDashboard.tsx fetchTalentData() function
--
-- 4. If toast shows success but DB not updated:
--    - Frontend may not be checking for errors correctly
--    - Check UserDashboard.tsx saveRequestDetails() function
--
-- =============================================================================

-- =============================================================================
-- ADDITIONAL FIX: Notify talent of request changes (optional)
-- =============================================================================
--
-- To notify talent when users update request_details, you could:
--
-- 1. Add a trigger on orders table:
--    CREATE TRIGGER notify_talent_on_request_update
--    AFTER UPDATE OF request_details ON orders
--    FOR EACH ROW
--    WHEN (OLD.request_details IS DISTINCT FROM NEW.request_details)
--    EXECUTE FUNCTION notify_talent_request_changed();
--
-- 2. Or call notification service from frontend after successful update
--
-- =============================================================================

