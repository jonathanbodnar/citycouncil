-- Fix: User registered but still showing as beta instead of registered user
-- Phone: +12173368327

-- 1. Check current state of this phone number
SELECT 
  '🔍 PHONE +12173368327 STATUS' as check,
  'beta_signups' as source,
  id,
  phone_number,
  source as signup_source,
  created_at
FROM beta_signups
WHERE phone_number IN ('+12173368327', '2173368327', '12173368327')
UNION ALL
SELECT 
  '🔍 PHONE +12173368327 STATUS' as check,
  'users' as source,
  id,
  phone as phone_number,
  email as signup_source,
  created_at
FROM users
WHERE phone IN ('+12173368327', '2173368327', '12173368327');

-- 2. Show user record with this phone
SELECT 
  '👤 USER WITH THIS PHONE' as info,
  id,
  email,
  full_name,
  phone,
  user_type,
  sms_subscribed,
  user_tags,
  created_at
FROM users
WHERE phone IN ('+12173368327', '2173368327', '12173368327');

-- 3. Show beta_signup record with this phone
SELECT 
  '📱 BETA_SIGNUP WITH THIS PHONE' as info,
  id,
  phone_number,
  source,
  subscribed_at,
  created_at
FROM beta_signups
WHERE phone_number IN ('+12173368327', '2173368327', '12173368327');

-- 4. Check what the merge trigger sees
SELECT 
  '🔧 WHAT MERGE TRIGGER CHECKS' as debug,
  u.id as user_id,
  u.email,
  u.phone as user_phone,
  bs.id as beta_signup_id,
  bs.phone_number as beta_phone,
  CASE 
    WHEN u.phone = bs.phone_number THEN '✅ Exact match'
    WHEN u.phone = '+1' || bs.phone_number THEN '✅ Match with +1'
    WHEN '+1' || u.phone = bs.phone_number THEN '✅ Match without +1'
    ELSE '❌ No match'
  END as match_status
FROM beta_signups bs
LEFT JOIN users u ON (
  u.phone = bs.phone_number 
  OR u.phone = '+1' || bs.phone_number 
  OR '+1' || u.phone = bs.phone_number
)
WHERE bs.phone_number IN ('+12173368327', '2173368327', '12173368327');

-- 5. FIX: Manually trigger the merge for this specific user
-- Delete the beta_signup record (they're now a full user)
DELETE FROM beta_signups
WHERE phone_number IN ('+12173368327', '2173368327', '12173368327');

-- 6. FIX: Ensure user has correct settings
UPDATE users
SET 
  user_tags = ARRAY[]::TEXT[],  -- Remove 'beta' tag
  sms_subscribed = true,
  sms_subscribed_at = COALESCE(sms_subscribed_at, created_at)
WHERE phone IN ('+12173368327', '2173368327', '12173368327');

-- 7. Verify the fix
SELECT 
  '✅ AFTER FIX - USER STATUS' as result,
  id,
  email,
  full_name,
  phone,
  user_tags,
  sms_subscribed,
  created_at
FROM users
WHERE phone IN ('+12173368327', '2173368327', '12173368327');

-- 8. Verify beta_signup is deleted
SELECT 
  '✅ AFTER FIX - BETA_SIGNUPS' as result,
  COUNT(*) as count
FROM beta_signups
WHERE phone_number IN ('+12173368327', '2173368327', '12173368327');

-- 9. Check SMS stats now
SELECT 
  '📊 SMS STATS AFTER FIX' as stats,
  *
FROM get_sms_stats();

-- 10. Show all registered users (should include you now)
SELECT 
  '✅ ALL REGISTERED USERS NOW' as segment,
  email,
  phone_number,
  full_name,
  user_tags
FROM get_users_by_segment('registered')
ORDER BY full_name;

-- 11. Show all beta users (should NOT include you)
SELECT 
  '📱 ALL BETA USERS NOW' as segment,
  email,
  phone_number,
  full_name,
  user_tags
FROM get_users_by_segment('beta')
ORDER BY full_name;

