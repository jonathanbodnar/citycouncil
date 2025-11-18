-- Simple check: Do we have completed orders with videos?

SELECT 
    'Total completed orders with videos' as check_type,
    COUNT(*) as count
FROM orders
WHERE status = 'completed' 
  AND video_url IS NOT NULL;

-- Show sample
SELECT 
    o.id,
    tp.temp_full_name as talent_name,
    o.status,
    o.video_url IS NOT NULL as has_video,
    LEFT(o.video_url, 50) as video_url_preview
FROM orders o
LEFT JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE o.status = 'completed' 
  AND o.video_url IS NOT NULL
ORDER BY o.created_at DESC
LIMIT 5;

-- Check if anonymous users can see these (test the RLS policy)
-- This should return the same count as above if RLS is working
SET ROLE anon;

SELECT 
    'Can anon role see these orders?' as check_type,
    COUNT(*) as count
FROM orders
WHERE status = 'completed' 
  AND video_url IS NOT NULL;

-- Reset role
RESET ROLE;

