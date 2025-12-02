-- Check orders this month to debug analytics count

-- Show current month calculation
SELECT 
    'CURRENT MONTH INFO' as check_type,
    DATE_TRUNC('month', CURRENT_DATE) as first_day_of_month,
    CURRENT_DATE as today,
    CURRENT_TIMESTAMP as now;

-- Show all orders created this month
SELECT 
    'ORDERS THIS MONTH' as check_type,
    o.id,
    o.created_at,
    o.created_at::date as order_date,
    o.status,
    o.amount / 100.0 as amount_usd,
    u.full_name as customer_name,
    u.email as customer_email,
    tp.username as talent_username,
    tu.full_name as talent_name
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
LEFT JOIN talent_profiles tp ON o.talent_id = tp.id
LEFT JOIN users tu ON tp.user_id = tu.id
WHERE o.created_at >= DATE_TRUNC('month', CURRENT_DATE)
ORDER BY o.created_at DESC;

-- Count orders by date this month
SELECT 
    'ORDERS BY DATE' as check_type,
    o.created_at::date as order_date,
    COUNT(*) as order_count
FROM orders o
WHERE o.created_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY o.created_at::date
ORDER BY o.created_at::date DESC;

-- Total count this month
SELECT 
    'TOTAL COUNT' as check_type,
    COUNT(*) as total_orders_this_month
FROM orders
WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE);

