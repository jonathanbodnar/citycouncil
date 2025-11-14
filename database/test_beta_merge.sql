-- Test if beta signup merge is working
-- Run this to diagnose the issue

-- 1. Check if triggers exist
SELECT 
  'Trigger check' as check_type,
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%beta%'
  AND event_object_table = 'users';

-- 2. Check if merge functions exist
SELECT 
  'Function check' as check_type,
  proname as function_name,
  prosrc as function_body
FROM pg_proc
WHERE proname LIKE '%beta%';

-- 3. Show current beta_signups
SELECT 
  'Beta signups' as check_type,
  id,
  phone_number,
  subscribed_at,
  source
FROM beta_signups
ORDER BY created_at DESC;

-- 4. Check users with phone numbers
SELECT 
  'Users with phones' as check_type,
  id,
  email,
  phone,
  user_tags,
  sms_subscribed,
  user_type
FROM users
WHERE phone IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

-- 5. Test specific case - check if the phone exists in both places
-- Replace +1XXXXXXXXXX with the actual phone number you used
SELECT 
  'Duplicate check' as check_type,
  'beta_signups' as source,
  phone_number
FROM beta_signups
WHERE phone_number = '+1XXXXXXXXXX'  -- REPLACE THIS

UNION ALL

SELECT 
  'Duplicate check' as check_type,
  'users' as source,
  phone
FROM users
WHERE phone = '+1XXXXXXXXXX';  -- REPLACE THIS

-- 6. Check if the column names match
SELECT 
  'Column name check' as check_type,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('users', 'beta_signups')
  AND column_name IN ('phone', 'phone_number')
ORDER BY table_name, column_name;

