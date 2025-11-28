-- Check Kolton Krottinger's account for issues

-- 1. Find Kolton Krottinger in public.users
SELECT 
  'USER ACCOUNT' as check_type,
  id,
  email,
  full_name,
  phone,
  user_type,
  created_at,
  last_login,
  CASE 
    WHEN id IS NULL THEN '❌ User not found'
    WHEN user_type != 'user' THEN '⚠️ Wrong user type: ' || user_type
    WHEN email IS NULL THEN '⚠️ No email'
    ELSE '✅ Account OK'
  END as status
FROM users
WHERE full_name ILIKE '%kolton%krottinger%'
   OR email ILIKE '%kolton%'
   OR email ILIKE '%krottinger%';

-- 2. Check in auth.users
SELECT 
  'AUTH STATUS' as check_type,
  au.id,
  au.email,
  au.phone,
  au.email_confirmed_at,
  au.phone_confirmed_at,
  au.last_sign_in_at,
  au.created_at,
  au.raw_user_meta_data,
  CASE 
    WHEN au.id IS NULL THEN '❌ Not in auth.users'
    WHEN au.email_confirmed_at IS NULL THEN '⚠️ Email not confirmed'
    ELSE '✅ Auth OK'
  END as status
FROM auth.users au
WHERE au.id IN (
  SELECT id FROM users WHERE full_name ILIKE '%kolton%krottinger%'
)
OR au.email ILIKE '%kolton%'
OR au.email ILIKE '%krottinger%';

-- 3. Check for orders placed by Kolton
SELECT 
  'ORDERS BY KOLTON' as check_type,
  o.id as order_id,
  o.status,
  o.amount / 100.0 as amount_dollars,
  o.video_url,
  o.created_at,
  o.fulfillment_deadline,
  t.temp_full_name as talent_name,
  CASE 
    WHEN o.status = 'pending' AND o.video_url IS NULL THEN '⏳ Waiting for video'
    WHEN o.status = 'pending' AND o.video_url IS NOT NULL THEN '⚠️ Has video but still pending'
    WHEN o.status = 'completed' THEN '✅ Completed'
    ELSE '❓ Status: ' || o.status
  END as order_status
FROM orders o
JOIN talent_profiles t ON o.talent_id = t.id
WHERE o.user_id IN (
  SELECT id FROM users WHERE full_name ILIKE '%kolton%krottinger%'
)
ORDER BY o.created_at DESC;

-- 4. Check notifications for Kolton
SELECT 
  'NOTIFICATIONS' as check_type,
  n.id,
  n.type,
  n.title,
  n.message,
  n.is_read,
  n.created_at,
  o.id as order_id
FROM notifications n
LEFT JOIN orders o ON n.order_id = o.id
WHERE n.user_id IN (
  SELECT id FROM users WHERE full_name ILIKE '%kolton%krottinger%'
)
ORDER BY n.created_at DESC
LIMIT 10;

-- 5. Check if there are any issues with Kolton's orders
SELECT 
  'ISSUE SUMMARY' as info,
  u.id as user_id,
  u.email,
  u.full_name,
  COUNT(o.id) as total_orders,
  COUNT(CASE WHEN o.status = 'pending' THEN 1 END) as pending_orders,
  COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM auth.users WHERE id = u.id) THEN '❌ Missing from auth.users'
    WHEN u.user_type != 'user' THEN '⚠️ Wrong user_type'
    ELSE '✅ Account appears OK'
  END as account_status
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.full_name ILIKE '%kolton%krottinger%'
   OR u.email ILIKE '%kolton%'
   OR u.email ILIKE '%krottinger%'
GROUP BY u.id, u.email, u.full_name;

-- 6. Specific check for JP Sears orders from Kolton
SELECT 
  'KOLTON -> JP SEARS ORDERS' as check_type,
  o.id,
  o.status,
  o.created_at,
  o.video_url,
  u.email as customer_email,
  t.temp_full_name as talent_name,
  CASE 
    WHEN o.video_url IS NULL THEN '⏳ No video uploaded yet'
    ELSE '✅ Video uploaded: ' || LEFT(o.video_url, 50) || '...'
  END as upload_status
FROM orders o
JOIN users u ON o.user_id = u.id
JOIN talent_profiles t ON o.talent_id = t.id
WHERE u.full_name ILIKE '%kolton%krottinger%'
  AND t.temp_full_name ILIKE '%jp%sears%'
ORDER BY o.created_at DESC;

