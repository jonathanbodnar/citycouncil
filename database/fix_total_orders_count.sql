-- Fix total_orders field in talent_profiles to match actual order count

-- Step 1: Check current total_orders vs actual count
SELECT 
    tp.username,
    tp.total_orders as stored_count,
    COUNT(o.id) as actual_count,
    tp.total_orders - COUNT(o.id) as difference
FROM talent_profiles tp
LEFT JOIN orders o ON o.talent_id = tp.id
GROUP BY tp.id, tp.username, tp.total_orders
HAVING tp.total_orders != COUNT(o.id)
ORDER BY difference DESC;

-- Step 2: Update total_orders to match actual order count for ALL talent
UPDATE talent_profiles tp
SET total_orders = (
    SELECT COUNT(*) 
    FROM orders o 
    WHERE o.talent_id = tp.id
);

-- Step 3: Verify the update
SELECT 
    tp.username,
    tp.total_orders,
    COUNT(o.id) as actual_orders,
    COUNT(CASE WHEN o.status = 'completed' AND o.video_url IS NOT NULL THEN 1 END) as completed_with_video
FROM talent_profiles tp
LEFT JOIN orders o ON o.talent_id = tp.id
WHERE tp.is_active = true
GROUP BY tp.id, tp.username, tp.total_orders
ORDER BY tp.total_orders DESC
LIMIT 10;

