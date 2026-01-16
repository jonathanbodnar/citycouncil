-- Check why Melonie Mac and Kaitlin Bennett aren't showing on homepage

-- Check Melonie Mac
SELECT 
  '🔍 MELONIE MAC' as section,
  username,
  temp_full_name,
  is_active,
  total_orders,
  fulfilled_orders,
  (SELECT COUNT(*) FROM orders WHERE talent_id = tp.id AND status = 'completed' AND video_url IS NOT NULL) as completed_videos,
  (SELECT video_url FROM orders WHERE talent_id = tp.id AND status = 'completed' AND video_url IS NOT NULL ORDER BY completed_at DESC LIMIT 1) as most_recent_video
FROM talent_profiles tp
WHERE username = 'meloniemac';

-- Check Kaitlin Bennett
SELECT 
  '🔍 KAITLIN BENNETT' as section,
  username,
  temp_full_name,
  is_active,
  total_orders,
  fulfilled_orders,
  (SELECT COUNT(*) FROM orders WHERE talent_id = tp.id AND status = 'completed' AND video_url IS NOT NULL) as completed_videos,
  (SELECT video_url FROM orders WHERE talent_id = tp.id AND status = 'completed' AND video_url IS NOT NULL ORDER BY completed_at DESC LIMIT 1) as most_recent_video
FROM talent_profiles tp
WHERE username ILIKE '%kaitlin%' OR temp_full_name ILIKE '%bennett%';

-- Show all talent that SHOULD be on homepage (is_active, has orders, has videos)
SELECT 
  '✅ TALENT ON HOMEPAGE' as section,
  tp.username,
  tp.temp_full_name,
  tp.total_orders,
  (SELECT COUNT(*) FROM orders WHERE talent_id = tp.id AND status = 'completed' AND video_url IS NOT NULL) as completed_videos
FROM talent_profiles tp
WHERE tp.is_active = true
  AND tp.total_orders > 0
  AND EXISTS(
    SELECT 1 FROM orders 
    WHERE talent_id = tp.id 
    AND status = 'completed' 
    AND video_url IS NOT NULL
  )
ORDER BY tp.total_orders DESC;

-- Diagnosis
DO $$
DECLARE
  v_melonie_active BOOLEAN;
  v_melonie_videos INT;
  v_kaitlin_active BOOLEAN;
  v_kaitlin_videos INT;
BEGIN
  -- Check Melonie
  SELECT 
    is_active,
    (SELECT COUNT(*) FROM orders WHERE talent_id = tp.id AND status = 'completed' AND video_url IS NOT NULL)
  INTO v_melonie_active, v_melonie_videos
  FROM talent_profiles tp
  WHERE username = 'meloniemac';
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '🔍 WHY TALENT ARE MISSING FROM HOMEPAGE';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  
  IF v_melonie_active IS NULL THEN
    RAISE NOTICE '❌ MELONIE MAC: Profile not found!';
  ELSIF NOT v_melonie_active THEN
    RAISE NOTICE '❌ MELONIE MAC: is_active = FALSE (set to true)';
  ELSIF v_melonie_videos = 0 THEN
    RAISE NOTICE '❌ MELONIE MAC: No completed videos with video_url';
  ELSE
    RAISE NOTICE '✅ MELONIE MAC: Should be showing (active=%%, videos=%%)', v_melonie_active, v_melonie_videos;
  END IF;
  
  -- Check Kaitlin
  SELECT 
    is_active,
    (SELECT COUNT(*) FROM orders WHERE talent_id = tp.id AND status = 'completed' AND video_url IS NOT NULL)
  INTO v_kaitlin_active, v_kaitlin_videos
  FROM talent_profiles tp
  WHERE username ILIKE '%kaitlin%' OR temp_full_name ILIKE '%bennett%'
  LIMIT 1;
  
  IF v_kaitlin_active IS NULL THEN
    RAISE NOTICE '❌ KAITLIN BENNETT: Profile not found!';
  ELSIF NOT v_kaitlin_active THEN
    RAISE NOTICE '❌ KAITLIN BENNETT: is_active = FALSE (set to true)';
  ELSIF v_kaitlin_videos = 0 THEN
    RAISE NOTICE '❌ KAITLIN BENNETT: No completed videos with video_url';
  ELSE
    RAISE NOTICE '✅ KAITLIN BENNETT: Should be showing (active=%%, videos=%%)', v_kaitlin_active, v_kaitlin_videos;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
END $$;
