-- Detailed check: Why isn't Melonie Mac showing?

-- Her exact stats
SELECT 
  '🔍 MELONIE MAC DETAILS' as section,
  username,
  temp_full_name,
  is_active,
  total_orders,
  fulfilled_orders,
  average_rating,
  display_order,
  payout_onboarding_completed
FROM talent_profiles
WHERE username = 'meloniemac';

-- Her completed videos
SELECT 
  '📹 MELONIE COMPLETED VIDEOS' as section,
  id,
  status,
  video_url,
  completed_at,
  CASE 
    WHEN video_url IS NOT NULL THEN '✅ Has video'
    ELSE '❌ No video'
  END as video_status
FROM orders
WHERE talent_id = (SELECT id FROM talent_profiles WHERE username = 'meloniemac')
  AND status = 'completed'
ORDER BY completed_at DESC
LIMIT 10;

-- Her reviews
SELECT 
  '⭐ MELONIE REVIEWS' as section,
  rating,
  comment,
  created_at
FROM reviews
WHERE talent_id = (SELECT id FROM talent_profiles WHERE username = 'meloniemac')
ORDER BY created_at DESC
LIMIT 5;

-- Check each filter requirement
DO $$
DECLARE
  v_is_active BOOLEAN;
  v_total_orders INT;
  v_average_rating DECIMAL;
  v_has_videos BOOLEAN;
  v_display_order INT;
BEGIN
  SELECT 
    is_active,
    total_orders,
    average_rating,
    display_order,
    EXISTS(
      SELECT 1 FROM orders 
      WHERE talent_id = tp.id 
      AND status = 'completed' 
      AND video_url IS NOT NULL
    )
  INTO v_is_active, v_total_orders, v_average_rating, v_display_order, v_has_videos
  FROM talent_profiles tp
  WHERE username = 'meloniemac';
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '🔍 MELONIE MAC HOMEPAGE FILTER CHECK';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '1. is_active = true: %', CASE WHEN v_is_active THEN '✅ PASS' ELSE '❌ FAIL - SET TO ACTIVE!' END;
  RAISE NOTICE '2. total_orders > 0: %', CASE WHEN v_total_orders > 0 THEN '✅ PASS (' || v_total_orders || ' orders)' ELSE '❌ FAIL' END;
  RAISE NOTICE '3. average_rating > 0: %', CASE WHEN v_average_rating > 0 THEN '✅ PASS (' || v_average_rating || ' stars)' ELSE '❌ FAIL - NO AVERAGE RATING!' END;
  RAISE NOTICE '4. Has completed videos: %', CASE WHEN v_has_videos THEN '✅ PASS' ELSE '❌ FAIL - NO VIDEOS!' END;
  RAISE NOTICE '5. display_order: %', COALESCE(v_display_order::TEXT, 'NULL (will appear after positioned talent)');
  RAISE NOTICE '';
  
  IF v_is_active AND v_total_orders > 0 AND v_average_rating > 0 AND v_has_videos THEN
    RAISE NOTICE '✅ MELONIE SHOULD BE SHOWING!';
    RAISE NOTICE 'If she''s not showing, it''s a code/cache issue.';
  ELSE
    RAISE NOTICE '❌ MELONIE IS BEING FILTERED OUT';
    RAISE NOTICE '';
    RAISE NOTICE 'FIX:';
    IF NOT v_is_active THEN
      RAISE NOTICE '  - Set is_active = true in Admin > Talent > Edit';
    END IF;
    IF v_average_rating = 0 THEN
      RAISE NOTICE '  - Check if reviews exist but average_rating = 0';
      RAISE NOTICE '  - Run: UPDATE talent_profiles SET average_rating = (SELECT AVG(rating) FROM reviews WHERE talent_id = talent_profiles.id) WHERE username = ''meloniemac'';';
    END IF;
    IF NOT v_has_videos THEN
      RAISE NOTICE '  - She needs at least one completed order with video_url set';
    END IF;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
END $$;
