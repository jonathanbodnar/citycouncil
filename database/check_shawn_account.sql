-- Check Shawn Farash's account and orders

-- 1. Find Shawn's talent profile
SELECT 
  tp.id,
  tp.username,
  tp.user_id,
  COALESCE(u.full_name, tp.temp_full_name) as full_name,
  tp.is_active,
  tp.onboarding_completed,
  tp.pricing,
  tp.admin_fee_percentage,
  tp.created_at,
  tp.updated_at
FROM talent_profiles tp
LEFT JOIN users u ON u.id = tp.user_id
WHERE tp.username ILIKE '%shawn%farash%'
   OR LOWER(COALESCE(u.full_name, tp.temp_full_name)) LIKE '%shawn%farash%';

-- 2. Check his recent orders
SELECT 
  o.id,
  o.status,
  o.amount,
  o.video_url,
  o.video_url IS NOT NULL as has_video,
  o.is_demo,
  o.created_at,
  o.updated_at,
  LENGTH(o.video_url) as video_url_length,
  cu.full_name as customer_name,
  cu.email as customer_email
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN users u ON u.id = tp.user_id
LEFT JOIN users cu ON cu.id = o.user_id
WHERE tp.username ILIKE '%shawn%farash%'
   OR LOWER(COALESCE(u.full_name, tp.temp_full_name)) LIKE '%shawn%farash%'
ORDER BY o.created_at DESC
LIMIT 10;

-- 3. Check for any pending/in-progress orders waiting for video
SELECT 
  o.id,
  o.status,
  o.amount,
  o.request_details,
  o.recipient_name,
  o.video_url,
  o.is_demo,
  o.created_at,
  o.updated_at,
  EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600 as hours_since_created
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN users u ON u.id = tp.user_id
WHERE (tp.username ILIKE '%shawn%farash%'
   OR LOWER(COALESCE(u.full_name, tp.temp_full_name)) LIKE '%shawn%farash%')
  AND o.status IN ('pending', 'in_progress')
  AND o.video_url IS NULL
ORDER BY o.created_at DESC;

-- 4. Check if there are any recent video upload attempts (check updated_at)
SELECT 
  o.id,
  o.status,
  o.video_url,
  o.created_at,
  o.updated_at,
  o.updated_at - o.created_at as time_diff,
  CASE 
    WHEN o.video_url IS NULL AND o.updated_at > o.created_at + INTERVAL '1 minute' 
    THEN '⚠️ Possible failed upload attempt'
    ELSE '✅ No upload attempt or video exists'
  END as upload_status
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN users u ON u.id = tp.user_id
WHERE (tp.username ILIKE '%shawn%farash%'
   OR LOWER(COALESCE(u.full_name, tp.temp_full_name)) LIKE '%shawn%farash%')
  AND o.status IN ('pending', 'in_progress')
ORDER BY o.created_at DESC
LIMIT 10;

