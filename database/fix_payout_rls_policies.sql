-- Fix RLS policies for payouts and payout_batches tables
-- Issue: Talent can't see their own payout data (admin can see it, so data exists)
-- Solution: Add policies allowing talent to read their own payouts

-- 1. Check current policies
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('payouts', 'payout_batches')
ORDER BY tablename, policyname;

-- 2. Enable RLS if not already enabled
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_batches ENABLE ROW LEVEL SECURITY;

-- 3. Drop any existing policies to start fresh
DROP POLICY IF EXISTS "Talent can view own payouts" ON payouts;
DROP POLICY IF EXISTS "Talent can view own payout batches" ON payout_batches;
DROP POLICY IF EXISTS "Admin can view all payouts" ON payouts;
DROP POLICY IF EXISTS "Admin can view all payout batches" ON payout_batches;

-- 4. Create new policies for PAYOUTS table

-- Allow talent to view their own payouts
CREATE POLICY "Talent can view own payouts"
ON payouts
FOR SELECT
TO authenticated
USING (
  talent_id IN (
    SELECT id 
    FROM talent_profiles 
    WHERE user_id = auth.uid()
  )
);

-- Allow admins to view all payouts
CREATE POLICY "Admin can view all payouts"
ON payouts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM users 
    WHERE users.id = auth.uid() 
    AND users.user_type = 'admin'
  )
);

-- 5. Create new policies for PAYOUT_BATCHES table

-- Allow talent to view their own payout batches
CREATE POLICY "Talent can view own payout batches"
ON payout_batches
FOR SELECT
TO authenticated
USING (
  talent_id IN (
    SELECT id 
    FROM talent_profiles 
    WHERE user_id = auth.uid()
  )
);

-- Allow admins to view all payout batches
CREATE POLICY "Admin can view all payout batches"
ON payout_batches
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM users 
    WHERE users.id = auth.uid() 
    AND users.user_type = 'admin'
  )
);

-- 6. Verify the new policies
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('payouts', 'payout_batches')
ORDER BY tablename, policyname;

-- 7. Test query as if we're a talent user
-- (This simulates what the frontend query does)
SELECT 
  COUNT(*) as payout_count
FROM payouts
WHERE talent_id IN (
  SELECT id 
  FROM talent_profiles 
  WHERE username = 'jonathanbodnar'
);

SELECT 
  COUNT(*) as batch_count
FROM payout_batches
WHERE talent_id IN (
  SELECT id 
  FROM talent_profiles 
  WHERE username = 'jonathanbodnar'
);

