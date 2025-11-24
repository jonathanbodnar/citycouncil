-- Script to delete all orders for jonathanbodnar user

-- STEP 1: Find the user ID for jonathanbodnar
SELECT 
    id,
    email,
    full_name,
    user_type,
    created_at
FROM 
    users
WHERE 
    email LIKE '%jonathanbodnar%' OR full_name LIKE '%Jonathan%Bodnar%';

-- STEP 2: Check how many orders they have
SELECT 
    COUNT(*) as total_orders,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_orders,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_orders,
    SUM(amount) / 100.0 as total_amount_dollars
FROM 
    orders o
JOIN 
    users u ON o.user_id = u.id
WHERE 
    u.email LIKE '%jonathanbodnar%';

-- STEP 3: Show all orders for jonathanbodnar (for verification)
SELECT 
    o.id,
    o.created_at,
    o.status,
    o.amount / 100.0 as amount_dollars,
    tp.full_name as talent_name,
    o.request_details
FROM 
    orders o
JOIN 
    users u ON o.user_id = u.id
LEFT JOIN 
    talent_profiles tp ON o.talent_id = tp.id
WHERE 
    u.email LIKE '%jonathanbodnar%'
ORDER BY 
    o.created_at DESC;

-- STEP 4: Delete related records first (to avoid foreign key constraints)
-- Delete notifications related to these orders
DELETE FROM notifications 
WHERE order_id IN (
    SELECT o.id 
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE u.email LIKE '%jonathanbodnar%'
);

-- Delete payouts related to these orders
DELETE FROM payouts 
WHERE order_id IN (
    SELECT o.id 
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE u.email LIKE '%jonathanbodnar%'
);

-- STEP 5: Delete the orders themselves
DELETE FROM orders 
WHERE user_id IN (
    SELECT id 
    FROM users 
    WHERE email LIKE '%jonathanbodnar%'
);

-- STEP 6: Verify deletion
SELECT 
    COUNT(*) as remaining_orders
FROM 
    orders o
JOIN 
    users u ON o.user_id = u.id
WHERE 
    u.email LIKE '%jonathanbodnar%';

-- STEP 7: Update talent profiles total_orders count (recalculate)
-- This ensures the analytics show correct counts after deletion
UPDATE talent_profiles tp
SET total_orders = (
    SELECT COUNT(*)
    FROM orders o
    WHERE o.talent_id = tp.id
);

SELECT '✅ All orders for jonathanbodnar have been deleted and analytics updated.' AS status;
