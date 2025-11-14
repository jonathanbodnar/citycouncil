-- Find where the phone number is getting lost during signup

-- 1. Check if phone is in auth.users metadata but not in public.users
SELECT 
  '🔍 PHONE IN AUTH BUT NOT IN PUBLIC' as issue,
  au.id,
  au.email,
  au.raw_user_meta_data->>'full_name' as full_name,
  au.raw_user_meta_data->>'phone_number' as phone_in_auth_metadata,
  pu.phone as phone_in_public_table,
  au.created_at
FROM auth.users au
LEFT JOIN users pu ON au.id = pu.id
WHERE au.raw_user_meta_data->>'phone_number' IS NOT NULL
  AND au.raw_user_meta_data->>'phone_number' != ''
  AND (pu.phone IS NULL OR pu.phone = '')
ORDER BY au.created_at DESC
LIMIT 10;

-- 2. Show ALL recent users from auth.users with their metadata
SELECT 
  '📱 ALL RECENT AUTH.USERS' as info,
  id,
  email,
  raw_user_meta_data->>'full_name' as full_name,
  raw_user_meta_data->>'phone_number' as phone_metadata,
  raw_user_meta_data->>'user_type' as user_type_metadata,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 as minutes_ago
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- 3. Show ALL recent users from public.users
SELECT 
  '👤 ALL RECENT PUBLIC.USERS' as info,
  id,
  email,
  full_name,
  phone,
  user_type,
  sms_subscribed,
  user_tags,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 as minutes_ago
FROM users
ORDER BY created_at DESC
LIMIT 10;

-- 4. FIX: Copy phone from auth.users metadata to public.users
-- This handles cases where UPSERT didn't include the phone
UPDATE users pu
SET 
  phone = au.raw_user_meta_data->>'phone_number',
  sms_subscribed = true,
  sms_subscribed_at = COALESCE(pu.sms_subscribed_at, pu.created_at)
FROM auth.users au
WHERE pu.id = au.id
  AND au.raw_user_meta_data->>'phone_number' IS NOT NULL
  AND au.raw_user_meta_data->>'phone_number' != ''
  AND (pu.phone IS NULL OR pu.phone = '');

-- 5. Show users that were just fixed
SELECT 
  '✅ USERS JUST FIXED (phone copied from auth)' as result,
  pu.id,
  pu.email,
  pu.phone,
  pu.sms_subscribed,
  au.raw_user_meta_data->>'phone_number' as original_phone_in_auth,
  pu.created_at
FROM users pu
JOIN auth.users au ON pu.id = au.id
WHERE pu.phone IS NOT NULL
  AND pu.phone = au.raw_user_meta_data->>'phone_number'
ORDER BY pu.created_at DESC
LIMIT 10;

-- 6. Verify SMS stats now
SELECT 
  '📊 SMS STATS AFTER FIX' as info,
  *
FROM get_sms_stats();

-- 7. Show registered users segment
SELECT 
  '✅ REGISTERED USERS NOW' as segment,
  email,
  phone_number,
  full_name,
  user_tags
FROM get_users_by_segment('registered')
ORDER BY full_name
LIMIT 20;

-- 8. Show any remaining users with issues
SELECT 
  '❌ USERS STILL WITHOUT PHONE' as remaining_issues,
  pu.id,
  pu.email,
  pu.full_name,
  pu.phone as phone_in_public,
  au.raw_user_meta_data->>'phone_number' as phone_in_auth,
  pu.created_at
FROM users pu
JOIN auth.users au ON pu.id = au.id
WHERE pu.user_type = 'user'
  AND (pu.phone IS NULL OR pu.phone = '')
  AND au.created_at > NOW() - INTERVAL '7 days'
ORDER BY pu.created_at DESC;

