-- Check why recent videos aren't showing on talent profiles

-- Step 1: Check ALL columns in orders table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
ORDER BY ordinal_position;

-- Step 2: Check completed orders with videos for specific talent
SELECT 
    o.id,
    o.status,
    o.video_url,
    o.created_at,
    o.updated_at,
    tp.username,
    tp.temp_full_name,
    u.full_name as talent_name
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN users u ON u.id = tp.user_id
WHERE tp.username = 'jonathanbodnar' -- Change this to the talent you're checking
  AND o.status = 'completed'
  AND o.video_url IS NOT NULL
ORDER BY o.created_at DESC
LIMIT 10;

-- Step 3: Count completed orders with videos by talent
SELECT 
    tp.username,
    COALESCE(u.full_name, tp.temp_full_name) as talent_name,
    COUNT(*) as completed_orders_with_video
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN users u ON u.id = tp.user_id
WHERE o.status = 'completed'
  AND o.video_url IS NOT NULL
GROUP BY tp.username, u.full_name, tp.temp_full_name
ORDER BY completed_orders_with_video DESC
LIMIT 10;

-- Step 4: Check for any RLS policies that might filter videos
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'orders' 
  AND cmd = 'SELECT';

