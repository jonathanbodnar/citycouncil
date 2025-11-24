-- Backfill missing delivery notifications for completed orders

-- Create delivery notifications for all completed orders that don't have them
DO $$
DECLARE
  completed_order RECORD;
  notification_count INTEGER := 0;
BEGIN
  FOR completed_order IN 
    SELECT 
      o.id AS order_id,
      o.user_id,
      o.talent_id,
      tp.temp_full_name AS talent_name,
      tp.full_name AS talent_full_name,
      u.full_name AS user_name
    FROM orders o
    JOIN users u ON u.id = o.user_id
    LEFT JOIN talent_profiles tp ON tp.id = o.talent_id
    WHERE o.status = 'completed'
      AND o.video_url IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM notifications n 
        WHERE n.order_id = o.id 
        AND n.type = 'order_fulfilled'
      )
  LOOP
    -- Create the missing notification
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      is_read,
      order_id,
      created_at
    ) VALUES (
      completed_order.user_id,
      'order_fulfilled',
      '🎉 Your ShoutOut is Ready!',
      COALESCE(completed_order.talent_name, completed_order.talent_full_name, 'Your talent') || ' has completed your personalized video. Watch it now!',
      false,
      completed_order.order_id,
      NOW()
    );
    
    notification_count := notification_count + 1;
    
    RAISE NOTICE 'Created delivery notification for order % (user: %)', 
      completed_order.order_id, completed_order.user_name;
  END LOOP;
  
  RAISE NOTICE '✅ Created % delivery notifications', notification_count;
END $$;

-- Verify the fix
SELECT 
  '📊 VERIFICATION' AS check_type,
  COUNT(*) AS total_completed_orders,
  COUNT(DISTINCT n.order_id) AS orders_with_notification,
  COUNT(*) - COUNT(DISTINCT n.order_id) AS still_missing
FROM orders o
LEFT JOIN notifications n ON (
  n.order_id = o.id 
  AND n.type = 'order_fulfilled'
)
WHERE o.status = 'completed'
  AND o.video_url IS NOT NULL;

SELECT '✅ Backfill complete! Users should now see their delivery notifications.' AS status;

