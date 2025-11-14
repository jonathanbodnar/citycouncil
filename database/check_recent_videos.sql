-- Check why recent videos aren't showing on talent profiles

-- Step 1: Check completed orders with videos for specific talent
-- Replace 'username_here' with actual talent username
SELECT 
    o.id,
    o.status,
    o.video_url,
    o.share_on_profile,
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

-- Step 2: Check if share_on_profile column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND column_name IN ('share_on_profile', 'video_url', 'status');

-- Step 3: Count completed orders with videos by talent
SELECT 
    tp.username,
    tp.temp_full_name,
    COUNT(*) as completed_orders_with_video,
    COUNT(CASE WHEN o.share_on_profile = true THEN 1 END) as shareable_videos,
    COUNT(CASE WHEN o.share_on_profile IS NULL THEN 1 END) as null_share_status
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE o.status = 'completed'
  AND o.video_url IS NOT NULL
GROUP BY tp.username, tp.temp_full_name
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

