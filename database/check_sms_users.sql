-- Diagnostic: Check SMS-eligible users
-- Run this to see why user counts are showing 0

-- 1. Check total users with phone numbers by type
SELECT 
  user_type,
  COUNT(*) as total_with_phone,
  COUNT(CASE WHEN sms_subscribed = true THEN 1 END) as sms_subscribed_count,
  COUNT(CASE WHEN user_tags IS NOT NULL THEN 1 END) as has_tags,
  COUNT(CASE WHEN 'beta' = ANY(user_tags) THEN 1 END) as beta_tagged
FROM users
WHERE phone_number IS NOT NULL
GROUP BY user_type;

-- 2. Sample of regular users with phones
SELECT 
  id,
  full_name,
  email,
  phone_number,
  user_type,
  sms_subscribed,
  user_tags,
  created_at
FROM users
WHERE phone_number IS NOT NULL
  AND user_type = 'user'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Test get_sms_stats function
SELECT * FROM get_sms_stats();

-- 4. Test get_users_by_segment for each segment
SELECT 'beta' as segment, COUNT(*) as count FROM get_users_by_segment('beta')
UNION ALL
SELECT 'registered' as segment, COUNT(*) as count FROM get_users_by_segment('registered')
UNION ALL
SELECT 'all' as segment, COUNT(*) as count FROM get_users_by_segment('all')
UNION ALL
SELECT 'talent' as segment, COUNT(*) as count FROM get_users_by_segment('talent');

-- 5. Check if sms_subscribed column exists and its default
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('sms_subscribed', 'user_tags', 'phone_number');

