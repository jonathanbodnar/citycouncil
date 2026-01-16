-- Check Melonie Mac's completed orders and videos

SELECT 
  '📹 MELONIE COMPLETED ORDERS' as section,
  id,
  status,
  video_url,
  completed_at,
  created_at,
  CASE 
    WHEN video_url IS NOT NULL THEN '✅ HAS VIDEO URL'
    WHEN status = 'completed' THEN '❌ COMPLETED BUT NO VIDEO URL!'
    ELSE 'Not completed'
  END as video_status
FROM orders
WHERE talent_id = (SELECT id FROM talent_profiles WHERE username = 'meloniemac')
  AND status = 'completed'
ORDER BY completed_at DESC NULLS LAST, created_at DESC
LIMIT 20;

-- Check if ANY videos exist
DO $$
DECLARE
  v_total_completed INT;
  v_with_videos INT;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE video_url IS NOT NULL)
  INTO v_total_completed, v_with_videos
  FROM orders
  WHERE talent_id = (SELECT id FROM talent_profiles WHERE username = 'meloniemac')
    AND status = 'completed';
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '🔍 MELONIE MAC VIDEO STATUS';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Total completed orders: %', v_total_completed;
  RAISE NOTICE 'Completed orders WITH video_url: %', v_with_videos;
  RAISE NOTICE '';
  
  IF v_total_completed > 0 AND v_with_videos = 0 THEN
    RAISE NOTICE '❌ PROBLEM: She has % completed orders but NONE have video_url!', v_total_completed;
    RAISE NOTICE '';
    RAISE NOTICE 'This is why she''s not showing on homepage.';
    RAISE NOTICE '';
    RAISE NOTICE 'SOLUTION:';
    RAISE NOTICE '1. Go to Admin > Orders';
    RAISE NOTICE '2. Find Melonie Mac''s completed orders';
    RAISE NOTICE '3. Add video URLs to the completed orders';
    RAISE NOTICE '4. OR remove the video_url requirement from homepage query';
    RAISE NOTICE '';
  ELSIF v_with_videos > 0 THEN
    RAISE NOTICE '✅ She has % videos - homepage filter should work', v_with_videos;
    RAISE NOTICE '   If she''s still not showing, it''s a code/cache issue.';
  ELSE
    RAISE NOTICE '⚠️  She has no completed orders at all';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
END $$;
