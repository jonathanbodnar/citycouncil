-- DELETE all orders FOR the talent jonathanbodnar
-- ⚠️ THIS WILL IMMEDIATELY DELETE - USE WITH CAUTION ⚠️

-- Step 1: Show what will be deleted
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

-- Step 2: Delete notifications for these orders
DELETE FROM notifications
WHERE order_id IN (
    SELECT o.id 
    FROM orders o
    JOIN talent_profiles tp ON o.talent_id = tp.id
    JOIN users u ON tp.user_id = u.id
    WHERE u.email = 'jb@apollo.inc' OR tp.username LIKE '%jonathanbodnar%'
);

-- Step 3: Delete payouts for these orders
DELETE FROM payouts
WHERE order_id IN (
    SELECT o.id 
    FROM orders o
    JOIN talent_profiles tp ON o.talent_id = tp.id
    JOIN users u ON tp.user_id = u.id
    WHERE u.email = 'jb@apollo.inc' OR tp.username LIKE '%jonathanbodnar%'
);

-- Step 4: Delete the orders themselves
DELETE FROM orders
WHERE talent_id IN (
    SELECT tp.id 
    FROM talent_profiles tp
    JOIN users u ON tp.user_id = u.id
    WHERE u.email = 'jb@apollo.inc' OR tp.username LIKE '%jonathanbodnar%'
);

-- Step 5: Delete payout batches for this talent
DELETE FROM payout_batches
WHERE talent_id IN (
    SELECT tp.id 
    FROM talent_profiles tp
    JOIN users u ON tp.user_id = u.id
    WHERE u.email = 'jb@apollo.inc' OR tp.username LIKE '%jonathanbodnar%'
);

-- Step 6: Reset talent's total_orders and earnings to 0
UPDATE talent_profiles tp
SET 
    total_orders = 0,
    total_earnings = 0,
    current_month_orders = 0,
    updated_at = NOW()
WHERE tp.id IN (
    SELECT tp2.id 
    FROM talent_profiles tp2
    JOIN users u ON tp2.user_id = u.id
    WHERE u.email = 'jb@apollo.inc' OR tp2.username LIKE '%jonathanbodnar%'
);

-- Verification
SELECT 
    '✅ DELETION COMPLETE' AS status,
    'Remaining orders: ' || COUNT(*)::TEXT AS result
FROM 
    orders o
JOIN 
    talent_profiles tp ON o.talent_id = tp.id
JOIN 
    users u ON tp.user_id = u.id
WHERE 
    u.email = 'jb@apollo.inc'
    OR tp.username LIKE '%jonathanbodnar%';

SELECT 
    '✅ TALENT STATS RESET' AS status,
    tp.full_name,
    tp.total_orders,
    tp.total_earnings,
    tp.current_month_orders
FROM 
    talent_profiles tp
JOIN 
    users u ON tp.user_id = u.id
WHERE 
    u.email = 'jb@apollo.inc';

