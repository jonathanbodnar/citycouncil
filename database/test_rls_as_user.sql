-- Test if RLS policies are working correctly
-- This simulates what happens when the frontend queries as a talent user

-- 1. First, show current policies
SELECT 
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('payouts', 'payout_batches')
ORDER BY tablename, policyname;

-- 2. Check if there's a syntax error in the policy definition
-- Look for the exact policy definition
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual as using_clause,
    with_check
FROM pg_policies
WHERE tablename = 'payouts';

-- 3. Get Jonathan's user_id to test with
SELECT 
    u.id as user_id,
    tp.id as talent_id,
    tp.username
FROM users u
JOIN talent_profiles tp ON tp.user_id = u.id
WHERE tp.username = 'jonathanbodnar';

-- 4. Test the exact query the frontend is making
-- This should work if RLS is set up correctly
SELECT 
    p.*
FROM payouts p
WHERE p.talent_id IN (
    SELECT tp.id 
    FROM talent_profiles tp
    WHERE tp.user_id = '0ee53913-7a65-4b83-8ab4-990208647525' -- Replace with actual user_id from step 3
);

-- 5. Test without the subquery (simpler check)
SELECT 
    p.*
FROM payouts p
JOIN talent_profiles tp ON tp.id = p.talent_id
WHERE tp.username = 'jonathanbodnar';

-- 6. Check if the issue is with the orders join in the frontend query
SELECT 
    p.*,
    o.id as order_id,
    o.request_details,
    o.created_at as order_created_at
FROM payouts p
LEFT JOIN orders o ON o.id = p.order_id
WHERE p.talent_id IN (
    SELECT tp.id 
    FROM talent_profiles tp
    WHERE tp.username = 'jonathanbodnar'
);

