-- Check if total_orders field matches actual order count

-- Compare talent_profiles.total_orders vs actual orders count
SELECT 
    tp.username,
    COALESCE(u.full_name, tp.temp_full_name) as talent_name,
    tp.total_orders as stored_count,
    COUNT(o.id) as actual_orders,
    COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders,
    COUNT(CASE WHEN o.status = 'completed' AND o.video_url IS NOT NULL THEN 1 END) as completed_with_video,
    tp.total_orders = COUNT(o.id) as counts_match
FROM talent_profiles tp
LEFT JOIN users u ON u.id = tp.user_id
LEFT JOIN orders o ON o.talent_id = tp.id
WHERE tp.is_active = true
GROUP BY tp.id, tp.username, u.full_name, tp.temp_full_name, tp.total_orders
ORDER BY actual_orders DESC
LIMIT 20;

-- Check specific talent (change username)
SELECT 
    tp.username,
    COALESCE(u.full_name, tp.temp_full_name) as talent_name,
    tp.total_orders as stored_count,
    tp.fulfilled_orders,
    tp.average_rating,
    COUNT(o.id) as actual_total_orders,
    COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as actual_completed,
    COUNT(CASE WHEN o.video_url IS NOT NULL THEN 1 END) as orders_with_video
FROM talent_profiles tp
LEFT JOIN users u ON u.id = tp.user_id
LEFT JOIN orders o ON o.talent_id = tp.id
WHERE tp.username = 'jonathanbodnar' -- Change this
GROUP BY tp.id, tp.username, u.full_name, tp.temp_full_name;

-- List all orders for a specific talent
SELECT 
    o.id,
    o.status,
    o.amount,
    o.video_url IS NOT NULL as has_video,
    o.created_at,
    u.full_name as customer_name
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN users u ON u.id = o.user_id
WHERE tp.username = 'jonathanbodnar' -- Change this
ORDER BY o.created_at DESC;

