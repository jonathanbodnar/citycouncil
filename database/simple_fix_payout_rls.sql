-- Simple, direct fix for payout RLS policies
-- Run this to allow talent to see their payouts

-- 1. First, let's see what policies exist
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('payouts', 'payout_batches');

-- 2. Drop ALL existing policies on both tables
DROP POLICY IF EXISTS "Talent can view own payouts" ON payouts;
DROP POLICY IF EXISTS "Talent can view own payout batches" ON payout_batches;
DROP POLICY IF EXISTS "Admin can view all payouts" ON payouts;
DROP POLICY IF EXISTS "Admin can view all payout batches" ON payout_batches;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON payouts;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON payout_batches;

-- 3. Make sure RLS is enabled
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_batches ENABLE ROW LEVEL SECURITY;

-- 4. Create simple, working policies

-- PAYOUTS: Let talent see their own
CREATE POLICY "talent_view_own_payouts"
ON payouts
FOR SELECT
TO authenticated
USING (
  talent_id IN (
    SELECT tp.id 
    FROM talent_profiles tp
    WHERE tp.user_id = auth.uid()
  )
);

-- PAYOUTS: Let admins see all
CREATE POLICY "admin_view_all_payouts"
ON payouts
FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT id 
    FROM users 
    WHERE user_type = 'admin'
  )
);

-- PAYOUT_BATCHES: Let talent see their own
CREATE POLICY "talent_view_own_batches"
ON payout_batches
FOR SELECT
TO authenticated
USING (
  talent_id IN (
    SELECT tp.id 
    FROM talent_profiles tp
    WHERE tp.user_id = auth.uid()
  )
);

-- PAYOUT_BATCHES: Let admins see all
CREATE POLICY "admin_view_all_batches"
ON payout_batches
FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT id 
    FROM users 
    WHERE user_type = 'admin'
  )
);

-- 5. Verify policies were created
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('payouts', 'payout_batches')
ORDER BY tablename, policyname;

-- 6. Test: Check if data exists (run this as superuser/admin)
SELECT 
    'payouts' as table_name,
    COUNT(*) as total_rows,
    COUNT(DISTINCT talent_id) as unique_talent
FROM payouts

UNION ALL

SELECT 
    'payout_batches' as table_name,
    COUNT(*) as total_rows,
    COUNT(DISTINCT talent_id) as unique_talent
FROM payout_batches;

-- 7. Test: Check Jonathan's specific data
SELECT 
    tp.username,
    tp.user_id,
    COUNT(p.id) as payout_count,
    SUM(p.payout_amount) as total_payouts
FROM talent_profiles tp
LEFT JOIN payouts p ON p.talent_id = tp.id
WHERE tp.username = 'jonathanbodnar'
GROUP BY tp.username, tp.user_id;

-- 8. Test: Check Jonathan's batches
SELECT 
    tp.username,
    COUNT(pb.id) as batch_count,
    SUM(pb.net_payout_amount) as total_net_payout
FROM talent_profiles tp
LEFT JOIN payout_batches pb ON pb.talent_id = tp.id
WHERE tp.username = 'jonathanbodnar'
GROUP BY tp.username;

