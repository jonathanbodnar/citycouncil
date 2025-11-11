-- Check if SMS notifications can be sent

-- 1. Check notification settings
SELECT 
  '=== NOTIFICATION SETTINGS ===' as section,
  notification_type,
  sms_enabled,
  CASE WHEN sms_template IS NOT NULL THEN '✅ Has template' ELSE '❌ No template' END as template_status
FROM notification_settings
ORDER BY notification_type;

-- 2. Check which users have phone numbers
SELECT 
  '=== USERS WITH PHONE NUMBERS ===' as section,
  user_type,
  COUNT(*) as total_users,
  COUNT(phone) FILTER (WHERE phone IS NOT NULL AND phone != '') as users_with_phone,
  COUNT(phone) FILTER (WHERE phone IS NULL OR phone = '') as users_without_phone
FROM users
GROUP BY user_type;

-- 3. Check hellonew's phone number
SELECT 
  '=== HELLONEW PHONE STATUS ===' as section,
  u.full_name,
  u.email,
  u.user_type,
  CASE 
    WHEN u.phone IS NOT NULL AND u.phone != '' THEN '✅ Has phone: ' || u.phone
    ELSE '❌ No phone number'
  END as phone_status
FROM users u
JOIN talent_profiles tp ON tp.user_id = u.id
WHERE tp.full_name ILIKE '%hellonew%';

-- 4. Show sample of users with phones
SELECT 
  '=== SAMPLE USERS WITH PHONES ===' as section,
  full_name,
  email,
  user_type,
  phone
FROM users
WHERE phone IS NOT NULL AND phone != ''
LIMIT 5;

