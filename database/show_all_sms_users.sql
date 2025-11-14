-- Show ALL SMS-eligible users and where they're coming from
-- This will help understand why counts might seem wrong

-- 1. Show all beta_signups (landing page only, haven't registered yet)
SELECT 
  '🔵 BETA SIGNUPS (Landing Page - Not Registered Yet)' as category,
  phone_number,
  'N/A' as email,
  source,
  subscribed_at
FROM beta_signups
ORDER BY subscribed_at DESC;

-- 2. Show all users with 'beta' tag (registered users who came from landing page)
SELECT 
  '🟢 BETA USERS (Registered - Came from Landing Page)' as category,
  phone as phone_number,
  email,
  'registered' as source,
  created_at as subscribed_at
FROM users
WHERE 'beta' = ANY(user_tags)
  AND sms_subscribed = true
ORDER BY created_at DESC;

-- 3. Show all registered users WITHOUT 'beta' tag (direct signups)
SELECT 
  '🟡 REGISTERED USERS (Direct Signup - Never on Landing)' as category,
  phone as phone_number,
  email,
  'direct_signup' as source,
  created_at as subscribed_at
FROM users
WHERE sms_subscribed = true
  AND user_type = 'user'
  AND (user_tags IS NULL OR NOT ('beta' = ANY(user_tags)))
ORDER BY created_at DESC;

-- 4. Summary counts
SELECT 
  'SUMMARY' as section,
  (SELECT COUNT(*) FROM beta_signups) as beta_signups_count,
  (SELECT COUNT(*) FROM users WHERE 'beta' = ANY(user_tags)) as registered_beta_users,
  (SELECT COUNT(*) FROM users WHERE sms_subscribed = true AND user_type = 'user' AND NOT ('beta' = ANY(COALESCE(user_tags, ARRAY[]::TEXT[])))) as registered_non_beta_users,
  (SELECT COUNT(*) FROM beta_signups) + (SELECT COUNT(*) FROM users WHERE 'beta' = ANY(user_tags)) as total_beta,
  (SELECT COUNT(*) FROM beta_signups) + (SELECT COUNT(*) FROM users WHERE sms_subscribed = true AND user_type = 'user') as total_all;

-- 5. What the Comms Center shows
SELECT 
  'COMMS CENTER STATS' as section,
  (SELECT COUNT(*) FROM get_users_by_segment('beta')) as beta_subscribers,
  (SELECT COUNT(*) FROM get_users_by_segment('registered')) as registered_subscribers,
  (SELECT COUNT(*) FROM get_users_by_segment('all')) as total_subscribers;

-- 6. If you see duplicates, run this to clean up:
SELECT 
  '⚠️  CLEANUP NEEDED?' as status,
  COUNT(*) as duplicate_count,
  'Run the DELETE command below if count > 0' as action
FROM beta_signups bs
WHERE EXISTS (
  SELECT 1 FROM users u
  WHERE bs.phone_number = u.phone
     OR bs.phone_number = '+1' || u.phone
     OR REPLACE(bs.phone_number, '+1', '') = u.phone
);

-- 7. CLEANUP COMMAND (uncomment if needed):
/*
DELETE FROM beta_signups
WHERE phone_number IN (
  SELECT bs.phone_number
  FROM beta_signups bs
  JOIN users u ON (
    bs.phone_number = u.phone OR
    bs.phone_number = '+1' || u.phone OR
    REPLACE(bs.phone_number, '+1', '') = u.phone
  )
);
*/

