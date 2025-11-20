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

-- Step 3: Check if Hayley's orders have any file references
-- Look for order IDs in video filenames
SELECT 
  'Video Files Matching Hayley Orders' AS check_type,
  o.id AS order_id,
  o.status AS order_status,
  o.video_url,
  o.updated_at AS order_last_updated,
  so.name AS storage_filename,
  so.created_at AS file_uploaded_at,
  CASE 
    WHEN o.video_url IS NOT NULL THEN '✅ Video URL saved'
    WHEN so.name IS NOT NULL THEN '⚠️ File exists but not linked!'
    ELSE '📝 No file found'
  END AS sync_status
FROM orders o
LEFT JOIN storage.objects so ON (
  so.bucket_id = 'videos' 
  AND so.name ILIKE '%' || o.id::text || '%'
)
WHERE o.talent_id IN (
  SELECT id FROM talent_profiles 
  WHERE temp_full_name ILIKE '%hayley%caronia%'
)
ORDER BY o.created_at DESC;

-- Step 4: Check storage bucket for recent video uploads
-- Look for videos uploaded recently (might not be linked to orders yet)
SELECT 
  'Storage Videos (Last 7 Days)' AS check_type,
  name AS video_filename,
  created_at AS uploaded_at,
  updated_at AS last_modified,
  metadata->>'size' AS file_size_bytes,
  CASE 
    WHEN metadata->>'mimetype' LIKE '%video%' THEN '✅ Video file'
    ELSE '⚠️ Not a video'
  END AS file_type
FROM storage.objects
WHERE bucket_id = 'videos'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 20;

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

