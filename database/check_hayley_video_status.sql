-- Check Hayley Caronia's video submission status
-- This will help diagnose if video is stuck in watermarking or upload

-- Step 1: Find Hayley's talent profile
SELECT 
  'Hayley''s Talent Profile' AS check_type,
  tp.id AS talent_id,
  tp.temp_full_name AS name,
  tp.username,
  tp.is_active,
  u.email,
  u.phone
FROM talent_profiles tp
LEFT JOIN users u ON tp.user_id = u.id
WHERE tp.temp_full_name ILIKE '%hayley%caronia%'
   OR tp.full_name ILIKE '%hayley%caronia%'
   OR u.full_name ILIKE '%hayley%caronia%';

-- Step 2: Check all of Hayley's orders
SELECT 
  'Hayley''s Orders' AS check_type,
  o.id AS order_id,
  o.status,
  o.order_type,
  o.video_url,
  o.created_at,
  o.updated_at,
  o.request_details,
  CASE 
    WHEN o.video_url IS NOT NULL THEN '✅ Has video URL'
    WHEN o.status = 'completed' THEN '⚠️ Marked completed but NO video URL!'
    WHEN o.status = 'in_progress' THEN '🔄 In progress - waiting for upload'
    ELSE '📝 Pending'
  END AS video_status,
  u.full_name AS customer_name,
  u.email AS customer_email
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
WHERE o.talent_id IN (
  SELECT id FROM talent_profiles 
  WHERE temp_full_name ILIKE '%hayley%caronia%'
     OR full_name ILIKE '%hayley%caronia%'
)
ORDER BY o.created_at DESC;

-- Step 3: Check for any video files in storage (if exists)
-- This checks if video was uploaded but video_url wasn't saved
SELECT 
  'Recent Video Uploads' AS check_type,
  name AS file_name,
  id AS file_id,
  created_at AS uploaded_at,
  metadata,
  CASE 
    WHEN name ILIKE '%hayley%' THEN '✅ Likely Hayley''s video'
    ELSE 'Other talent'
  END AS match_status
FROM storage.objects
WHERE bucket_id = 'videos'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 20;

-- Step 4: Check for watermark jobs or Edge Function logs
-- Look for recent watermark attempts
SELECT 
  'Edge Function Invocations' AS check_type,
  id,
  created_at,
  request_id,
  metadata
FROM supabase_functions.hooks
WHERE function_name = 'watermark-video'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 10;

-- Step 5: Check if order was manually marked as completed without video
SELECT 
  'Orders Marked Completed Without Video' AS check_type,
  o.id AS order_id,
  o.status,
  o.updated_at AS last_updated,
  o.request_details,
  tp.temp_full_name AS talent_name,
  u.full_name AS customer_name
FROM orders o
LEFT JOIN talent_profiles tp ON o.talent_id = tp.id
LEFT JOIN users u ON o.user_id = u.id
WHERE tp.temp_full_name ILIKE '%hayley%caronia%'
  AND o.status = 'completed'
  AND o.video_url IS NULL
ORDER BY o.updated_at DESC;

-- Step 6: Check order history/audit if it exists
-- (Uncomment if you have an audit table)
-- SELECT 
--   'Order Update History' AS check_type,
--   *
-- FROM order_audit_log
-- WHERE order_id IN (
--   SELECT id FROM orders WHERE talent_id IN (
--     SELECT id FROM talent_profiles WHERE temp_full_name ILIKE '%hayley%caronia%'
--   )
-- )
-- ORDER BY created_at DESC;

-- Summary Report
SELECT 
  '📊 SUMMARY' AS report_type,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_orders,
  COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_orders,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_orders,
  COUNT(*) FILTER (WHERE status = 'completed' AND video_url IS NULL) AS completed_no_video,
  COUNT(*) FILTER (WHERE video_url IS NOT NULL) AS orders_with_video
FROM orders
WHERE talent_id IN (
  SELECT id FROM talent_profiles 
  WHERE temp_full_name ILIKE '%hayley%caronia%'
     OR full_name ILIKE '%hayley%caronia%'
);

