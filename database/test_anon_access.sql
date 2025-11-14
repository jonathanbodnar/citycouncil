-- Test if anonymous users can actually access completed orders

-- Step 1: Verify the policy exists
SELECT 
    policyname,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'orders' 
  AND policyname = 'Public can view completed orders with videos';

-- Step 2: Test query as if you were anonymous (this simulates what the frontend sees)
-- This should return completed orders with videos
SELECT 
    o.id,
    o.talent_id,
    o.status,
    o.video_url,
    o.created_at
FROM orders o
WHERE o.status = 'completed' 
  AND o.video_url IS NOT NULL
ORDER BY o.created_at DESC
LIMIT 5;

-- Step 3: Count completed orders by talent (what the profile page needs)
SELECT 
    tp.username,
    COUNT(o.id) as completed_orders_with_video
FROM talent_profiles tp
LEFT JOIN orders o ON o.talent_id = tp.id 
  AND o.status = 'completed' 
  AND o.video_url IS NOT NULL
WHERE tp.is_active = true
GROUP BY tp.username
HAVING COUNT(o.id) > 0
ORDER BY completed_orders_with_video DESC;

-- Step 4: Test the EXACT query that TalentProfilePage uses
-- For a specific talent (change username as needed)
SELECT 
    o.video_url, 
    o.created_at
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE tp.username = 'jonathanbodnar'
  AND o.status = 'completed'
  AND o.video_url IS NOT NULL
ORDER BY o.created_at DESC
LIMIT 6;

