-- Check for upload attempts and errors in Supabase logs
-- This queries the Supabase logging system

-- Step 1: Check recent storage bucket activity
-- Look for any upload attempts (successful or failed)
SELECT 
  'Recent Storage Activity' AS check_type,
  created_at,
  bucket_id,
  owner,
  name AS filename,
  metadata->>'size' AS file_size,
  metadata->>'mimetype' AS mime_type,
  updated_at,
  last_accessed_at
FROM storage.objects
WHERE bucket_id = 'videos'
  AND created_at > NOW() - INTERVAL '3 days'
ORDER BY created_at DESC
LIMIT 30;

-- Step 2: Check for Hayley's recent activity in orders table
-- Look for any updates to her orders (might indicate upload attempts)
SELECT 
  'Hayley Order Updates (Last 3 Days)' AS check_type,
  o.id AS order_id,
  o.status,
  o.video_url,
  o.created_at AS order_created,
  o.updated_at AS last_updated,
  EXTRACT(EPOCH FROM (o.updated_at - o.created_at)) / 3600 AS hours_since_creation,
  CASE 
    WHEN o.updated_at > o.created_at + INTERVAL '1 minute' THEN '✅ Order was modified'
    ELSE '📝 No modifications'
  END AS activity_status
FROM orders o
WHERE o.talent_id IN (
  SELECT id FROM talent_profiles 
  WHERE temp_full_name ILIKE '%hayley%caronia%'
)
AND o.updated_at > NOW() - INTERVAL '3 days'
ORDER BY o.updated_at DESC;

-- Step 3: Check for failed uploads or errors
-- Look in storage.buckets for any error logs if they exist
SELECT 
  'Storage Bucket Config' AS check_type,
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'videos';

-- Step 4: Check if there are any orphaned files (uploaded but not in orders)
WITH hayley_orders AS (
  SELECT id, video_url
  FROM orders
  WHERE talent_id IN (
    SELECT id FROM talent_profiles 
    WHERE temp_full_name ILIKE '%hayley%caronia%'
  )
)
SELECT 
  'Potentially Orphaned Videos' AS check_type,
  so.name AS filename,
  so.created_at AS uploaded_at,
  so.metadata->>'size' AS file_size_bytes,
  so.owner AS uploaded_by_user_id,
  CASE 
    WHEN ho.id IS NOT NULL THEN '✅ Linked to order: ' || ho.id::text
    ELSE '⚠️ Not linked to any order!'
  END AS link_status
FROM storage.objects so
LEFT JOIN hayley_orders ho ON so.name ILIKE '%' || ho.id::text || '%'
WHERE so.bucket_id = 'videos'
  AND so.created_at > NOW() - INTERVAL '7 days'
  AND (
    so.owner IN (
      SELECT user_id FROM talent_profiles 
      WHERE temp_full_name ILIKE '%hayley%caronia%'
    )
    OR so.name ILIKE '%hayley%'
  )
ORDER BY so.created_at DESC;

-- Step 5: Check auth logs for Hayley's recent activity
-- See when she last logged in and what she did
SELECT 
  'Hayley Recent Auth Activity' AS check_type,
  u.id AS user_id,
  u.email,
  u.last_sign_in_at,
  u.created_at AS account_created,
  EXTRACT(EPOCH FROM (NOW() - u.last_sign_in_at)) / 3600 AS hours_since_last_login,
  u.confirmation_sent_at,
  u.confirmed_at
FROM auth.users u
WHERE u.id IN (
  SELECT user_id FROM talent_profiles 
  WHERE temp_full_name ILIKE '%hayley%caronia%'
)
OR u.email ILIKE '%hayley%caronia%';

-- Step 6: Summary of upload attempts
SELECT 
  '📊 UPLOAD ATTEMPT SUMMARY' AS report_type,
  COUNT(DISTINCT so.name) AS total_videos_in_storage,
  COUNT(DISTINCT o.id) AS total_orders,
  COUNT(DISTINCT o.id) FILTER (WHERE o.video_url IS NOT NULL) AS orders_with_video,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'in_progress') AS in_progress_orders,
  COUNT(DISTINCT so.name) FILTER (
    WHERE NOT EXISTS (
      SELECT 1 FROM orders WHERE video_url ILIKE '%' || so.name || '%'
    )
  ) AS orphaned_videos
FROM storage.objects so
CROSS JOIN orders o
WHERE so.bucket_id = 'videos'
  AND so.created_at > NOW() - INTERVAL '7 days'
  AND o.talent_id IN (
    SELECT id FROM talent_profiles 
    WHERE temp_full_name ILIKE '%hayley%caronia%'
  );

