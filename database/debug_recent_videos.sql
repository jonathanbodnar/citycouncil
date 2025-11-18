-- Debug why recent videos aren't showing on talent profiles
-- Run this to diagnose the issue

-- STEP 1: Check if the RLS policy exists
SELECT 
    'RLS Policy Check' as check_type,
    COUNT(*) as policy_count,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Policy EXISTS'
        ELSE '❌ Policy MISSING'
    END as status
FROM pg_policies 
WHERE tablename = 'orders' 
  AND policyname = 'Public can view completed orders with videos';

-- STEP 2: Check if there are any completed orders with videos
SELECT 
    'Completed Orders with Videos' as check_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) > 0 THEN CONCAT('✅ Found ', COUNT(*), ' orders')
        ELSE '❌ No completed orders with videos'
    END as status
FROM orders
WHERE status = 'completed' 
  AND video_url IS NOT NULL;

-- STEP 3: Show sample of completed orders with videos (top 5)
SELECT 
    'Sample Orders' as label,
    o.id,
    o.talent_id,
    tp.temp_full_name as talent_name,
    o.status,
    o.video_url IS NOT NULL as has_video,
    o.created_at
FROM orders o
LEFT JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE o.status = 'completed' 
  AND o.video_url IS NOT NULL
ORDER BY o.created_at DESC
LIMIT 5;

-- STEP 4: Show all RLS policies on orders table
SELECT 
    'All Orders RLS Policies' as label,
    policyname,
    cmd,
    qual,
    roles
FROM pg_policies 
WHERE tablename = 'orders'
ORDER BY policyname;

-- STEP 5: Check if RLS is enabled on orders table
SELECT 
    'RLS Status' as check_type,
    tablename,
    rowsecurity,
    CASE 
        WHEN rowsecurity THEN '✅ RLS ENABLED'
        ELSE '❌ RLS DISABLED'
    END as status
FROM pg_tables
WHERE tablename = 'orders';

