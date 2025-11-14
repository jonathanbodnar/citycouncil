-- Delete talent profile for "barney"
-- This will cascade delete related records

-- 1. First check what exists for barney
SELECT 
    tp.id as talent_id,
    tp.username,
    tp.temp_full_name,
    tp.user_id,
    u.email,
    u.full_name,
    u.user_type,
    u.created_at
FROM talent_profiles tp
LEFT JOIN users u ON u.id = tp.user_id
WHERE tp.username = 'barney';

-- 2. Check related data that will be deleted
SELECT 'Orders' as table_name, COUNT(*) as count
FROM orders WHERE talent_id IN (SELECT id FROM talent_profiles WHERE username = 'barney')
UNION ALL
SELECT 'Reviews', COUNT(*)
FROM reviews WHERE talent_id IN (SELECT id FROM talent_profiles WHERE username = 'barney')
UNION ALL
SELECT 'Payouts', COUNT(*)
FROM payouts WHERE talent_id IN (SELECT id FROM talent_profiles WHERE username = 'barney')
UNION ALL
SELECT 'Payout Batches', COUNT(*)
FROM payout_batches WHERE talent_id IN (SELECT id FROM talent_profiles WHERE username = 'barney')
UNION ALL
SELECT 'Notifications (via orders)', COUNT(*)
FROM notifications WHERE order_id IN (
    SELECT id FROM orders WHERE talent_id IN (SELECT id FROM talent_profiles WHERE username = 'barney')
);

-- 3. Delete in correct order (respecting foreign keys)

-- Delete notifications (linked to orders)
DELETE FROM notifications 
WHERE order_id IN (
    SELECT id FROM orders WHERE talent_id IN (SELECT id FROM talent_profiles WHERE username = 'barney')
);

-- Delete payout batches
DELETE FROM payout_batches 
WHERE talent_id IN (SELECT id FROM talent_profiles WHERE username = 'barney');

-- Delete payouts
DELETE FROM payouts 
WHERE talent_id IN (SELECT id FROM talent_profiles WHERE username = 'barney');

-- Delete reviews
DELETE FROM reviews 
WHERE talent_id IN (SELECT id FROM talent_profiles WHERE username = 'barney');

-- Delete orders
DELETE FROM orders 
WHERE talent_id IN (SELECT id FROM talent_profiles WHERE username = 'barney');

-- Delete talent profile
DELETE FROM talent_profiles 
WHERE username = 'barney';

-- Delete user account (if exists and only if they're a talent user)
DELETE FROM users 
WHERE id IN (
    SELECT user_id 
    FROM talent_profiles 
    WHERE username = 'barney'
)
AND user_type = 'talent';

-- 4. Verify deletion
SELECT 
    'Talent Profile' as check_type,
    COUNT(*) as remaining_count
FROM talent_profiles WHERE username = 'barney'
UNION ALL
SELECT 
    'Orders',
    COUNT(*)
FROM orders WHERE talent_id IN (SELECT id FROM talent_profiles WHERE username = 'barney');

-- Final message
SELECT 'Barney has been deleted from the database' as result;

