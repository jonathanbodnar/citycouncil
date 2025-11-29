-- Find and remove JP Sears' most recent public video

-- First, let's see what his most recent videos are
SELECT 
    'JP SEARS RECENT VIDEOS' as check_type,
    o.id as order_id,
    o.video_url,
    o.status,
    o.created_at,
    o.updated_at,
    u.full_name as customer_name,
    LEFT(o.request_details, 100) as request_preview
FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.talent_id = (
    SELECT id FROM talent_profiles WHERE username = 'jpsears'
)
AND o.video_url IS NOT NULL
AND o.status = 'completed'
ORDER BY o.updated_at DESC
LIMIT 5;

-- To delete the most recent video URL (removes from profile but keeps order), 
-- first verify which one above, then uncomment and run this:
/*
UPDATE orders
SET video_url = NULL
WHERE id = 'PASTE_ORDER_ID_HERE';
*/

-- Verify the change
SELECT 
    'AFTER UPDATE' as check_type,
    o.id as order_id,
    o.video_url,
    o.created_at
FROM orders o
WHERE o.talent_id = (
    SELECT id FROM talent_profiles WHERE username = 'jpsears'
)
AND o.updated_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY o.updated_at DESC;

