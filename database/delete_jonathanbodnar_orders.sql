-- Script to delete all orders FOR the talent jonathanbodnar
-- (Orders placed TO this talent, not orders placed BY them as a user)

-- STEP 1: Find the talent profile ID for jonathanbodnar
SELECT 
    tp.id as talent_id,
    tp.full_name,
    tp.username,
    u.email,
    tp.total_orders,
    tp.is_active
FROM 
    talent_profiles tp
JOIN 
    users u ON tp.user_id = u.id
WHERE 
    u.email LIKE '%jonathanbodnar%' 
    OR u.email = 'hi@gmail.com'
    OR tp.username LIKE '%jonathanbodnar%'
    OR tp.full_name LIKE '%Jonathan%Bodnar%';

-- STEP 2: Check how many orders this talent has received
SELECT 
    COUNT(*) as total_orders,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_orders,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_orders,
    SUM(amount) / 100.0 as total_amount_dollars
FROM 
    orders o
JOIN 
    talent_profiles tp ON o.talent_id = tp.id
JOIN 
    users u ON tp.user_id = u.id
WHERE 
    (u.email LIKE '%jonathanbodnar%' OR u.email = 'hi@gmail.com' OR tp.username LIKE '%jonathanbodnar%');

-- STEP 3: Show all orders for this talent (for verification)
SELECT 
    o.id,
    o.created_at,
    o.status,
    o.amount / 100.0 as amount_dollars,
    tp.full_name as talent_name,
    customer.full_name as customer_name,
    customer.email as customer_email,
    o.request_details
FROM 
    orders o
JOIN 
    talent_profiles tp ON o.talent_id = tp.id
JOIN 
    users u ON tp.user_id = u.id
JOIN 
    users customer ON o.user_id = customer.id
WHERE 
    (u.email LIKE '%jonathanbodnar%' OR u.email = 'hi@gmail.com' OR tp.username LIKE '%jonathanbodnar%')
ORDER BY 
    o.created_at DESC;

-- STEP 4: Delete related records first (to avoid foreign key constraints)
-- Delete notifications related to these orders
DELETE FROM notifications 
WHERE order_id IN (
    SELECT o.id 
    FROM orders o
    JOIN talent_profiles tp ON o.talent_id = tp.id
    JOIN users u ON tp.user_id = u.id
    WHERE u.email LIKE '%jonathanbodnar%' OR u.email = 'hi@gmail.com' OR tp.username LIKE '%jonathanbodnar%'
);

-- Delete payouts related to these orders
DELETE FROM payouts 
WHERE order_id IN (
    SELECT o.id 
    FROM orders o
    JOIN talent_profiles tp ON o.talent_id = tp.id
    JOIN users u ON tp.user_id = u.id
    WHERE u.email LIKE '%jonathanbodnar%' OR u.email = 'hi@gmail.com' OR tp.username LIKE '%jonathanbodnar%'
);

-- STEP 5: Delete the orders themselves
DELETE FROM orders 
WHERE talent_id IN (
    SELECT tp.id 
    FROM talent_profiles tp
    JOIN users u ON tp.user_id = u.id
    WHERE u.email LIKE '%jonathanbodnar%' OR u.email = 'hi@gmail.com' OR tp.username LIKE '%jonathanbodnar%'
);

-- STEP 6: Verify deletion
SELECT 
    COUNT(*) as remaining_orders
FROM 
    orders o
JOIN 
    talent_profiles tp ON o.talent_id = tp.id
JOIN 
    users u ON tp.user_id = u.id
WHERE 
    (u.email LIKE '%jonathanbodnar%' OR u.email = 'hi@gmail.com' OR tp.username LIKE '%jonathanbodnar%');

-- STEP 7: Update this talent's total_orders count to 0
UPDATE talent_profiles tp
SET total_orders = 0
WHERE tp.id IN (
    SELECT tp2.id 
    FROM talent_profiles tp2
    JOIN users u ON tp2.user_id = u.id
    WHERE u.email LIKE '%jonathanbodnar%' OR u.email = 'hi@gmail.com' OR tp2.username LIKE '%jonathanbodnar%'
);

SELECT '✅ All orders FOR talent jonathanbodnar have been deleted and analytics updated.' AS status;
