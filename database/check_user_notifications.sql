-- Check user notifications for video delivery
-- Run this to diagnose why users aren't seeing platform notifications

-- Step 1: Check if notifications table has RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'notifications';

-- Step 2: Check RLS policies on notifications table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'notifications';

-- Step 3: Check recent order completions and their associated notifications
SELECT 
    o.id as order_id,
    o.user_id,
    o.talent_id,
    o.status,
    o.video_url IS NOT NULL as has_video,
    o.updated_at as order_updated,
    u.email as user_email,
    u.full_name as user_name,
    -- Check if notification exists
    (SELECT COUNT(*) FROM notifications n WHERE n.order_id = o.id AND n.type = 'order_fulfilled') as fulfilled_notification_count,
    (SELECT MAX(created_at) FROM notifications n WHERE n.order_id = o.id AND n.type = 'order_fulfilled') as fulfilled_notification_created
FROM orders o
JOIN users u ON u.id = o.user_id
WHERE o.status = 'completed' 
  AND o.video_url IS NOT NULL
ORDER BY o.updated_at DESC
LIMIT 10;

-- Step 4: Check all notifications for completed orders
SELECT 
    n.id,
    n.user_id,
    n.type,
    n.title,
    n.message,
    n.is_read,
    n.created_at,
    n.order_id,
    o.status as order_status,
    u.email as user_email
FROM notifications n
LEFT JOIN orders o ON o.id = n.order_id
LEFT JOIN users u ON u.id = n.user_id
WHERE n.type IN ('order_fulfilled', 'order_placed')
ORDER BY n.created_at DESC
LIMIT 20;

-- Step 5: Check notification settings for user_order_completed
SELECT 
    notification_type,
    display_name,
    description,
    in_app_enabled,
    email_enabled,
    sms_enabled,
    sms_template
FROM notification_settings
WHERE notification_type IN ('user_order_completed', 'user_order_placed', 'user_order_approved');

-- Step 6: For a specific user, check their notifications
-- Replace with actual user_id if you want to test a specific user
-- SELECT 
--     n.*,
--     o.status as order_status,
--     tp.users->>'full_name' as talent_name
-- FROM notifications n
-- LEFT JOIN orders o ON o.id = n.order_id
-- LEFT JOIN talent_profiles tp ON tp.id = o.talent_id
-- WHERE n.user_id = 'USER_ID_HERE'
-- ORDER BY n.created_at DESC;

