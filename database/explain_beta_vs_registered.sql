-- Explain Beta vs Registered User Classification
-- This shows how users are categorized in the SMS system

-- The SMS system has these segments:
-- 1. BETA: Users who signed up from landing page (even if they later registered)
-- 2. REGISTERED: Users who registered directly (never signed up on landing page)
-- 3. ALL: Everyone (Beta + Registered)

-- Let's see how your user is classified:

-- 1. Check user's tags
SELECT 
  'User classification' as check_type,
  email,
  phone,
  user_tags,
  sms_subscribed,
  CASE 
    WHEN 'beta' = ANY(user_tags) THEN '✅ BETA USER (signed up from landing page)'
    ELSE '📝 REGISTERED USER (direct signup)'
  END as classification
FROM users
WHERE phone IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

-- 2. Show how get_users_by_segment categorizes them
SELECT 
  'Beta segment (landing page signups)' as segment,
  COUNT(*) as count
FROM get_users_by_segment('beta');

SELECT 
  'Registered segment (direct signups)' as segment,
  COUNT(*) as count
FROM get_users_by_segment('registered');

-- 3. Show actual users in each segment
SELECT 
  'BETA USERS' as segment,
  id,
  full_name,
  email,
  phone_number,
  user_tags
FROM get_users_by_segment('beta')
LIMIT 10;

SELECT 
  'REGISTERED USERS' as segment,
  id,
  full_name,
  email,
  phone_number,
  user_tags
FROM get_users_by_segment('registered')
LIMIT 10;

-- 4. IMPORTANT: If you want the user to NOT be counted as "beta":
--    You need to REMOVE the 'beta' tag from their user_tags
--    But this is usually NOT what you want because:
--    - They DID sign up from the landing page
--    - You might want to track/reward early adopters
--    - They're eligible for beta-specific campaigns

-- If you really want to move them from beta → registered:
-- UPDATE users
-- SET user_tags = array_remove(user_tags, 'beta')
-- WHERE email = 'their_email@example.com';

-- 5. Expected behavior:
SELECT 
  '=== EXPECTED BEHAVIOR ===' as info,
  'User signs up on landing page → beta_signups table' as step_1,
  'User later registers → users table WITH beta tag' as step_2,
  'Beta signup record deleted (no duplicate)' as step_3,
  'User counted in BETA segment (correct!)' as step_4,
  'User can still use full app features' as step_5;

