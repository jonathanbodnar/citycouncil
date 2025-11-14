-- Test notification creation for debugging
-- This will help identify if notifications are being created when videos are delivered

-- Step 1: Get a recent completed order with video
SELECT 
    o.id as order_id,
    o.user_id,
    o.talent_id,
    o.status,
    o.video_url IS NOT NULL as has_video,
    o.updated_at,
    u.email as user_email,
    u.full_name as user_name,
    tp_user.full_name as talent_name
FROM orders o
JOIN users u ON u.id = o.user_id
JOIN talent_profiles tp ON tp.id = o.talent_id
JOIN users tp_user ON tp_user.id = tp.user_id
WHERE o.status = 'completed' 
  AND o.video_url IS NOT NULL
ORDER BY o.updated_at DESC
LIMIT 5;

-- Step 2: Check notifications for those orders
SELECT 
    n.id,
    n.user_id,
    n.type,
    n.title,
    n.message,
    n.is_read,
    n.created_at,
    n.order_id,
    u.email as notified_user_email
FROM notifications n
JOIN users u ON u.id = n.user_id
WHERE n.order_id IN (
    SELECT id FROM orders 
    WHERE status = 'completed' 
    AND video_url IS NOT NULL
    ORDER BY updated_at DESC
    LIMIT 5
)
ORDER BY n.created_at DESC;

-- Step 3: Count notifications by type
SELECT 
    type,
    COUNT(*) as count,
    COUNT(CASE WHEN is_read THEN 1 END) as read_count,
    COUNT(CASE WHEN NOT is_read THEN 1 END) as unread_count
FROM notifications
GROUP BY type
ORDER BY count DESC;

-- Step 4: Check for any recent 'order_fulfilled' notifications
SELECT 
    n.*,
    u.email,
    o.status as order_status,
    o.video_url IS NOT NULL as order_has_video
FROM notifications n
JOIN users u ON u.id = n.user_id
LEFT JOIN orders o ON o.id = n.order_id
WHERE n.type = 'order_fulfilled'
ORDER BY n.created_at DESC
LIMIT 10;

