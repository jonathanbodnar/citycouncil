-- Fix RLS policy to allow talent to UPDATE their own orders
-- This is needed for video uploads to work

-- First, check current policies
SELECT 
  'Current UPDATE policies' as info,
  policyname,
  roles,
  qual
FROM pg_policies
WHERE tablename = 'orders'
  AND cmd = 'UPDATE';

-- Drop existing talent update policy if it exists
DROP POLICY IF EXISTS "Talent can update their orders" ON orders;

-- Create comprehensive UPDATE policy for talent
CREATE POLICY "Talent can update their orders"
ON orders
FOR UPDATE
TO authenticated
USING (
  -- Talent can update orders assigned to them
  talent_id IN (
    SELECT id FROM talent_profiles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  -- Talent can update orders assigned to them
  talent_id IN (
    SELECT id FROM talent_profiles WHERE user_id = auth.uid()
  )
);

-- Verify the policy was created
SELECT 
  '✅ Policy created/updated' as result,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'orders'
  AND policyname = 'Talent can update their orders';

-- Test: Show JP Sears' pending orders to verify they can now be updated
SELECT 
  'JP SEARS PENDING ORDERS (should be updatable now)' as info,
  o.id,
  o.status,
  o.created_at,
  u.full_name as customer_name
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
WHERE o.talent_id IN (
  SELECT id FROM talent_profiles WHERE temp_full_name ILIKE '%jp%sears%'
)
AND o.status = 'pending'
ORDER BY o.created_at DESC
LIMIT 5;

