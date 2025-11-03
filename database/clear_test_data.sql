-- Clear All Test Data (Analytics and Orders)
-- Run this in Supabase SQL Editor to reset the platform

-- WARNING: This will permanently delete all orders, reviews, and analytics data
-- Make sure to backup any data you want to keep before running this!

BEGIN;

-- 1. Clear all orders and related data
DELETE FROM reviews;
DELETE FROM notifications WHERE order_id IS NOT NULL;
DELETE FROM orders;

-- 2. Clear help desk messages (optional - uncomment if you want to clear these too)
-- DELETE FROM help_messages;

-- 3. Reset talent statistics to zero
UPDATE talent_profiles SET
  total_orders = 0,
  fulfilled_orders = 0,
  average_rating = 0.0
WHERE total_orders > 0 OR fulfilled_orders > 0 OR average_rating > 0;

-- 4. Clear any promotional video tracking data (if exists)
-- DELETE FROM promotional_videos_tracking;

-- 5. Clear social media tracking data
DELETE FROM instagram_activity_tracking;

-- 6. Clear email waitlist (optional - uncomment if you want to clear)
-- DELETE FROM email_waitlist;

-- NOTE: Watermarked video cache is NOT cleared to preserve video processing
-- If you want to clear it, uncomment the line below:
-- DELETE FROM watermarked_videos_cache;

-- 8. Reset spots remaining counter (if using landing page)
-- UPDATE app_settings SET value = '197' WHERE key = 'spots_remaining';

-- Verify the cleanup
SELECT 'Orders deleted' as action, COUNT(*) as remaining FROM orders
UNION ALL
SELECT 'Reviews deleted' as action, COUNT(*) as remaining FROM reviews
UNION ALL
SELECT 'Notifications deleted' as action, COUNT(*) as remaining FROM notifications WHERE order_id IS NOT NULL
UNION ALL
SELECT 'Talent profiles reset' as action, COUNT(*) as remaining FROM talent_profiles WHERE total_orders = 0;

COMMIT;

-- Success message
SELECT 'Test data cleared successfully!' as status;

