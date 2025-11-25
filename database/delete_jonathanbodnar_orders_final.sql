-- Delete all orders FOR the talent jonathanbodnar
-- (Orders placed TO this talent, not orders placed BY them as a user)

-- Step 1: Show what will be deleted (REVIEW THIS FIRST)
SELECT 
    '1. ORDERS TO BE DELETED' AS section,
    o.id AS order_id,
    o.status,
    o.amount / 100.0 AS amount_dollars,
    o.created_at,
    tp.full_name AS talent_name,
    customer.full_name AS customer_name,
    customer.email AS customer_email
FROM 
    orders o
JOIN 
    talent_profiles tp ON o.talent_id = tp.id
JOIN 
    users u ON tp.user_id = u.id
JOIN 
    users customer ON o.user_id = customer.id
WHERE 
    u.email = 'jb@apollo.inc'
    OR tp.username LIKE '%jonathanbodnar%'
ORDER BY 
    o.created_at DESC;

-- Step 2: Count what will be deleted
SELECT 
    '2. COUNTS' AS section,
    COUNT(*) AS total_orders_to_delete,
    COUNT(*) FILTER (WHERE o.status = 'pending') AS pending,
    COUNT(*) FILTER (WHERE o.status = 'in_progress') AS in_progress,
    COUNT(*) FILTER (WHERE o.status = 'completed') AS completed
FROM 
    orders o
JOIN 
    talent_profiles tp ON o.talent_id = tp.id
JOIN 
    users u ON tp.user_id = u.id
WHERE 
    u.email = 'jb@apollo.inc'
    OR tp.username LIKE '%jonathanbodnar%';

-- =====================================================================================================
-- !!! UNCOMMENT BELOW TO DELETE (Review the SELECT statements above first!) !!!
-- =====================================================================================================

-- Step 3: Delete notifications for these orders
-- DELETE FROM notifications
-- WHERE order_id IN (
--     SELECT o.id 
--     FROM orders o
--     JOIN talent_profiles tp ON o.talent_id = tp.id
--     JOIN users u ON tp.user_id = u.id
--     WHERE u.email = 'jb@apollo.inc' OR tp.username LIKE '%jonathanbodnar%'
-- );

-- Step 4: Delete payouts for these orders
-- DELETE FROM payouts
-- WHERE order_id IN (
--     SELECT o.id 
--     FROM orders o
--     JOIN talent_profiles tp ON o.talent_id = tp.id
--     JOIN users u ON tp.user_id = u.id
--     WHERE u.email = 'jb@apollo.inc' OR tp.username LIKE '%jonathanbodnar%'
-- );

-- Step 5: Delete the orders themselves
-- DELETE FROM orders
-- WHERE talent_id IN (
--     SELECT tp.id 
--     FROM talent_profiles tp
--     JOIN users u ON tp.user_id = u.id
--     WHERE u.email = 'jb@apollo.inc' OR tp.username LIKE '%jonathanbodnar%'
-- );

-- Step 6: Reset talent's total_orders and earnings to 0
-- UPDATE talent_profiles tp
-- SET 
--     total_orders = 0,
--     total_earnings = 0,
--     updated_at = NOW()
-- WHERE tp.id IN (
--     SELECT tp2.id 
--     FROM talent_profiles tp2
--     JOIN users u ON tp2.user_id = u.id
--     WHERE u.email = 'jb@apollo.inc' OR tp2.username LIKE '%jonathanbodnar%'
-- );

-- Step 7: Delete payout batches for this talent
-- DELETE FROM payout_batches
-- WHERE talent_id IN (
--     SELECT tp.id 
--     FROM talent_profiles tp
--     JOIN users u ON tp.user_id = u.id
--     WHERE u.email = 'jb@apollo.inc' OR tp.username LIKE '%jonathanbodnar%'
-- );

-- =====================================================================================================
-- VERIFICATION (after deletion)
-- =====================================================================================================

-- Step 8: Verify deletion
-- SELECT 
--     '8. VERIFICATION - REMAINING ORDERS' AS section,
--     COUNT(*) AS remaining_orders
-- FROM 
--     orders o
-- JOIN 
--     talent_profiles tp ON o.talent_id = tp.id
-- JOIN 
--     users u ON tp.user_id = u.id
-- WHERE 
--     u.email = 'jb@apollo.inc'
--     OR tp.username LIKE '%jonathanbodnar%';

-- SELECT 
--     '9. VERIFICATION - TALENT STATS' AS section,
--     tp.full_name,
--     tp.total_orders,
--     tp.total_earnings
-- FROM 
--     talent_profiles tp
-- JOIN 
--     users u ON tp.user_id = u.id
-- WHERE 
--     u.email = 'jb@apollo.inc';

SELECT '✅ Review the orders above, then uncomment the DELETE statements to proceed.' AS instructions;

