-- Check if users are receiving order delivery notifications

-- Step 1: Check recent completed orders with videos
SELECT 
    'Recent Completed Orders' AS check_type,
    o.id AS order_id,
    o.status,
    o.video_url IS NOT NULL AS has_video,
    o.created_at AS order_created,
    o.updated_at AS order_completed,
    u.id AS user_id,
    u.email AS user_email,
    u.full_name AS user_name
FROM orders o
JOIN users u ON u.id = o.user_id
WHERE o.status = 'completed' 
  AND o.video_url IS NOT NULL
ORDER BY o.updated_at DESC
LIMIT 10;

-- Step 2: Check if these orders have delivery notifications
SELECT 
    'Delivery Notifications for Completed Orders' AS check_type,
    o.id AS order_id,
    o.status AS order_status,
    o.updated_at AS order_completed_at,
    n.id AS notification_id,
    n.type AS notification_type,
    n.title,
    n.message,
    n.is_read,
    n.created_at AS notification_created,
    CASE 
        WHEN n.id IS NOT NULL THEN '✅ Notification exists'
        ELSE '❌ NO NOTIFICATION!'
    END AS notification_status
FROM orders o
LEFT JOIN notifications n ON (
    n.order_id = o.id 
    AND n.type = 'order_fulfilled'
)
WHERE o.status = 'completed' 
  AND o.video_url IS NOT NULL
ORDER BY o.updated_at DESC
LIMIT 15;

-- Step 3: Count notifications by type
SELECT 
    'Notification Counts by Type' AS check_type,
    type,
    COUNT(*) AS total_count,
    COUNT(*) FILTER (WHERE is_read = false) AS unread_count,
    COUNT(*) FILTER (WHERE is_read = true) AS read_count
FROM notifications
GROUP BY type
ORDER BY total_count DESC;

-- Step 4: Check all order_fulfilled notifications
SELECT 
    'All Order Fulfilled Notifications (Last 20)' AS check_type,
    n.id,
    n.user_id,
    n.title,
    n.message,
    n.is_read,
    n.created_at,
    u.email AS user_email,
    u.full_name AS user_name,
    o.id AS order_id,
    o.status AS order_status
FROM notifications n
LEFT JOIN users u ON u.id = n.user_id
LEFT JOIN orders o ON o.id = n.order_id
WHERE n.type = 'order_fulfilled'
ORDER BY n.created_at DESC
LIMIT 20;

-- Step 5: Find completed orders WITHOUT notifications (the problem!)
SELECT 
    'Completed Orders WITHOUT Delivery Notification' AS check_type,
    o.id AS order_id,
    o.status,
    o.updated_at AS completed_at,
    o.video_url IS NOT NULL AS has_video,
    u.id AS user_id,
    u.email AS user_email,
    u.full_name AS user_name,
    tp.temp_full_name AS talent_name,
    '❌ Missing notification!' AS issue
FROM orders o
JOIN users u ON u.id = o.user_id
LEFT JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE o.status = 'completed'
  AND o.video_url IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM notifications n 
      WHERE n.order_id = o.id 
      AND n.type = 'order_fulfilled'
  )
ORDER BY o.updated_at DESC
LIMIT 20;

-- Step 6: Summary Report
SELECT 
    '📊 SUMMARY' AS report_type,
    (SELECT COUNT(*) FROM orders WHERE status = 'completed' AND video_url IS NOT NULL) AS total_completed_orders,
    (SELECT COUNT(DISTINCT order_id) FROM notifications WHERE type = 'order_fulfilled') AS orders_with_notification,
    (SELECT COUNT(*) FROM orders WHERE status = 'completed' AND video_url IS NOT NULL AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.order_id = orders.id AND n.type = 'order_fulfilled')) AS orders_missing_notification,
    (SELECT COUNT(*) FROM notifications WHERE type = 'order_placed') AS order_placed_notifications,
    (SELECT COUNT(*) FROM notifications WHERE type = 'order_fulfilled') AS order_fulfilled_notifications;

