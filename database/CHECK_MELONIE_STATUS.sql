-- Check why Melonie Mac isn't showing on homepage

SELECT 
  'MELONIE MAC STATUS' as section,
  username,
  temp_full_name,
  is_active,
  total_orders,
  fulfilled_orders,
  average_rating,
  display_order,
  (SELECT COUNT(*) FROM orders WHERE talent_id = tp.id AND status = 'completed' AND video_url IS NOT NULL) as completed_videos,
  (SELECT COUNT(*) FROM reviews WHERE talent_id = tp.id) as total_reviews,
  (SELECT video_url FROM orders WHERE talent_id = tp.id AND status = 'completed' AND video_url IS NOT NULL ORDER BY completed_at DESC LIMIT 1) as most_recent_video,
  CASE 
    WHEN NOT is_active THEN '❌ NOT ACTIVE'
    WHEN total_orders = 0 THEN '❌ NO ORDERS'
    WHEN average_rating = 0 THEN '❌ NO REVIEWS (filtered out!)'
    WHEN NOT EXISTS(
      SELECT 1 FROM orders 
      WHERE talent_id = tp.id 
      AND status = 'completed' 
      AND video_url IS NOT NULL
    ) THEN '❌ NO COMPLETED VIDEOS'
    ELSE '✅ SHOULD BE SHOWING'
  END as status
FROM talent_profiles tp
WHERE username = 'meloniemac';

-- Check ALL talent that should be showing
SELECT 
  'TALENT ON HOMEPAGE' as section,
  username,
  temp_full_name,
  display_order,
  total_orders,
  average_rating,
  (SELECT COUNT(*) FROM orders WHERE talent_id = tp.id AND status = 'completed' AND video_url IS NOT NULL) as videos
FROM talent_profiles tp
WHERE is_active = true
  AND total_orders > 0
  AND average_rating > 0
  AND EXISTS(
    SELECT 1 FROM orders 
    WHERE talent_id = tp.id 
    AND status = 'completed' 
    AND video_url IS NOT NULL
  )
ORDER BY 
  CASE WHEN display_order IS NULL THEN 999 ELSE display_order END ASC,
  total_orders DESC;
