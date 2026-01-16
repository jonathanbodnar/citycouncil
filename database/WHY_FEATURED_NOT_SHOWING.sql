-- Show ALL featured talent and why they're not showing

SELECT 
  '🌟 ALL FEATURED TALENT' as section,
  username,
  temp_full_name as name,
  is_featured,
  is_active,
  total_orders,
  average_rating,
  display_order,
  (SELECT COUNT(*) FROM orders WHERE talent_id = tp.id AND status = 'completed' AND video_url IS NOT NULL) as completed_videos,
  (SELECT COUNT(*) FROM reviews WHERE talent_id = tp.id) as total_reviews,
  -- What's blocking them from homepage?
  CASE 
    WHEN NOT is_active THEN '❌ NOT ACTIVE'
    WHEN total_orders = 0 THEN '❌ NO ORDERS'
    WHEN average_rating = 0 OR average_rating IS NULL THEN '❌ NO AVERAGE RATING (has ' || (SELECT COUNT(*) FROM reviews WHERE talent_id = tp.id) || ' reviews)'
    WHEN NOT EXISTS(
      SELECT 1 FROM orders 
      WHERE talent_id = tp.id 
      AND status = 'completed' 
      AND video_url IS NOT NULL
    ) THEN '❌ NO COMPLETED VIDEOS'
    ELSE '✅ SHOULD BE SHOWING'
  END as blocking_reason
FROM talent_profiles tp
WHERE is_featured = true
ORDER BY username;

-- Quick fix for all featured talent with reviews but no average_rating
DO $$
DECLARE
  v_fixed_count INT := 0;
BEGIN
  -- Update average_rating for all featured talent who have reviews
  UPDATE talent_profiles tp
  SET average_rating = (
    SELECT COALESCE(AVG(rating), 0)
    FROM reviews r
    WHERE r.talent_id = tp.id
  )
  WHERE is_featured = true
    AND EXISTS(SELECT 1 FROM reviews WHERE talent_id = tp.id)
    AND (average_rating = 0 OR average_rating IS NULL);
  
  GET DIAGNOSTICS v_fixed_count = ROW_COUNT;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '🔧 AUTO-FIX APPLIED';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Updated average_rating for % featured talent who had reviews', v_fixed_count;
  RAISE NOTICE '';
  
  IF v_fixed_count > 0 THEN
    RAISE NOTICE '✅ These talent should now appear on homepage!';
    RAISE NOTICE 'Refresh the page to see them in the featured carousel.';
  ELSE
    RAISE NOTICE '⚠️  No talent needed average_rating updates.';
    RAISE NOTICE 'Check the blocking_reason column above for other issues.';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
END $$;

-- Show results after fix
SELECT 
  '✅ FEATURED TALENT AFTER FIX' as section,
  username,
  temp_full_name as name,
  average_rating,
  (SELECT COUNT(*) FROM reviews WHERE talent_id = tp.id) as total_reviews,
  CASE 
    WHEN is_active AND total_orders > 0 AND average_rating > 0 
      AND EXISTS(
        SELECT 1 FROM orders 
        WHERE talent_id = tp.id 
        AND status = 'completed' 
        AND video_url IS NOT NULL
      ) THEN '✅ NOW SHOWING'
    ELSE '❌ STILL BLOCKED'
  END as status
FROM talent_profiles tp
WHERE is_featured = true
ORDER BY username;
