-- Quick verification: Show all registered users after the fix

-- 1. Show registered users count
SELECT 
  '📊 REGISTERED USERS COUNT' as info,
  COUNT(*) as total
FROM get_users_by_segment('registered');

-- 2. Show all registered users
SELECT 
  '✅ ALL REGISTERED USERS' as segment,
  email,
  phone_number,
  full_name,
  user_tags
FROM get_users_by_segment('registered')
ORDER BY full_name;

-- 3. Show SMS stats
SELECT 
  '📊 SMS STATS' as info,
  *
FROM get_sms_stats();

-- 4. Check if phone +12173368327 exists in users table
SELECT 
  '🔍 YOUR USER ACCOUNT' as check,
  id,
  email,
  full_name,
  phone,
  user_tags,
  sms_subscribed,
  created_at
FROM users
WHERE phone IN ('+12173368327', '2173368327', '12173368327');

-- 5. Check if beta_signup was deleted
SELECT 
  '🗑️ BETA_SIGNUP DELETED?' as check,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Yes, deleted'
    ELSE '❌ Still exists'
  END as status
FROM beta_signups
WHERE phone_number IN ('+12173368327', '2173368327', '12173368327');

