-- Debug: Find ALL recent user registrations and their phone status

-- 1. Show the MOST RECENT 10 users (any type)
SELECT 
  '=== MOST RECENT 10 USERS ===' as debug,
  id,
  email,
  full_name,
  user_type,
  phone,
  sms_subscribed,
  user_tags,
  created_at,
  updated_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 as minutes_ago
FROM users
ORDER BY created_at DESC
LIMIT 10;

-- 2. Show users created in last 24 hours
SELECT 
  '=== USERS CREATED TODAY ===' as debug,
  id,
  email,
  full_name,
  user_type,
  phone,
  sms_subscribed,
  user_tags,
  created_at
FROM users
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 3. Check if phone is NULL or empty string for recent users
SELECT 
  '=== RECENT USERS WITH NO PHONE ===' as debug,
  id,
  email,
  full_name,
  user_type,
  CASE 
    WHEN phone IS NULL THEN 'NULL'
    WHEN phone = '' THEN 'EMPTY STRING'
    ELSE phone
  END as phone_status,
  created_at
FROM users
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND (phone IS NULL OR phone = '')
ORDER BY created_at DESC;

-- 4. Check if phone exists but in wrong format
SELECT 
  '=== RECENT USERS WITH PHONE ===' as debug,
  id,
  email,
  full_name,
  user_type,
  phone,
  LENGTH(phone) as phone_length,
  sms_subscribed,
  created_at
FROM users
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND phone IS NOT NULL
  AND phone != ''
ORDER BY created_at DESC;

-- 5. Check auth.users metadata (where phone might be stored)
SELECT 
  '=== AUTH.USERS METADATA ===' as debug,
  id,
  email,
  raw_user_meta_data->>'full_name' as full_name,
  raw_user_meta_data->>'phone_number' as phone_from_metadata,
  raw_user_meta_data->>'user_type' as user_type,
  created_at,
  updated_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- 6. Check if there's a mismatch between auth.users and public.users
SELECT 
  '=== USERS ONLY IN AUTH, NOT IN PUBLIC.USERS ===' as debug,
  au.id,
  au.email,
  au.raw_user_meta_data->>'full_name' as full_name,
  au.raw_user_meta_data->>'phone_number' as phone_in_auth,
  au.created_at as auth_created_at
FROM auth.users au
LEFT JOIN users pu ON au.id = pu.id
WHERE pu.id IS NULL
  AND au.created_at > NOW() - INTERVAL '24 hours'
ORDER BY au.created_at DESC;

-- 7. Check if user exists but phone wasn't copied from auth to public
SELECT 
  '=== PHONE MISMATCH: AUTH vs PUBLIC ===' as debug,
  au.email,
  au.raw_user_meta_data->>'phone_number' as phone_in_auth_metadata,
  pu.phone as phone_in_public_users,
  au.created_at
FROM auth.users au
JOIN users pu ON au.id = pu.id
WHERE au.created_at > NOW() - INTERVAL '24 hours'
  AND (
    (au.raw_user_meta_data->>'phone_number' IS NOT NULL AND pu.phone IS NULL)
    OR
    (au.raw_user_meta_data->>'phone_number' != pu.phone)
  )
ORDER BY au.created_at DESC;

-- 8. Show what get_users_by_segment actually returns
SELECT 
  '=== GET_USERS_BY_SEGMENT REGISTERED ===' as debug,
  COUNT(*) as total_count
FROM get_users_by_segment('registered');

SELECT 
  '=== ACTUAL REGISTERED USERS ===' as debug,
  email,
  phone_number as phone,
  full_name,
  user_tags
FROM get_users_by_segment('registered')
ORDER BY full_name
LIMIT 20;

-- 9. Check beta_signups table
SELECT 
  '=== RECENT BETA SIGNUPS ===' as debug,
  id,
  phone_number,
  source,
  subscribed_at,
  created_at
FROM beta_signups
ORDER BY created_at DESC
LIMIT 10;

