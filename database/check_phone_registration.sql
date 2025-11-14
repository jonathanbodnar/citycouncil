-- Check if phone numbers are being saved correctly during registration
-- This will show all recent users and their phone number status

-- 1. Show all recent users with their phone numbers
SELECT 
  'Recent users (last 10)' as check,
  id,
  email,
  full_name,
  phone,
  user_type,
  sms_subscribed,
  user_tags,
  created_at
FROM users
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check users with NULL or empty phone numbers
SELECT 
  'Users with NULL/empty phone' as issue,
  id,
  email,
  full_name,
  phone,
  created_at
FROM users
WHERE user_type = 'user'
  AND (phone IS NULL OR phone = '')
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check users with phone numbers but NULL sms_subscribed
SELECT 
  'Users with phone but NULL sms_subscribed' as issue,
  id,
  email,
  phone,
  sms_subscribed,
  created_at
FROM users
WHERE phone IS NOT NULL
  AND phone != ''
  AND sms_subscribed IS NULL
ORDER BY created_at DESC;

-- 4. Check phone number formats
SELECT 
  'Phone number formats' as check,
  phone,
  LENGTH(phone) as phone_length,
  CASE 
    WHEN phone LIKE '+1%' THEN 'Has +1 prefix'
    WHEN phone ~ '^\d{10}$' THEN '10 digits no prefix'
    WHEN phone ~ '^\d{11}$' THEN '11 digits (1XXXXXXXXXX)'
    ELSE 'Other format'
  END as format_type,
  COUNT(*) as count
FROM users
WHERE phone IS NOT NULL AND phone != ''
GROUP BY phone, LENGTH(phone)
ORDER BY LENGTH(phone) DESC;

-- 5. Check if auto_subscribe_sms trigger exists and is active
SELECT 
  'Trigger check' as check,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND trigger_name = 'trigger_auto_subscribe_sms';

-- 6. Test the trigger manually on a sample record
-- This shows what WOULD happen if a user registers with a phone
DO $$
DECLARE
  test_phone TEXT := '5551234567';  -- Example phone number
  test_result BOOLEAN;
BEGIN
  -- Simulate the trigger logic
  IF test_phone IS NOT NULL AND test_phone != '' THEN
    RAISE NOTICE '✅ Trigger WOULD set sms_subscribed = true for phone: %', test_phone;
  ELSE
    RAISE NOTICE '❌ Trigger would NOT fire (NULL or empty phone)';
  END IF;
END $$;

-- 7. Show the actual user you just registered
-- REPLACE 'your_email@example.com' with the actual email
SELECT 
  '🔍 Your newly registered user' as check,
  id,
  email,
  full_name,
  phone,
  user_type,
  sms_subscribed,
  user_tags,
  created_at
FROM users
WHERE email = 'REPLACE_WITH_EMAIL@example.com'  -- REPLACE THIS
ORDER BY created_at DESC
LIMIT 1;

-- 8. Check if phone column exists vs phone_number column
SELECT 
  'Column check' as check,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('phone', 'phone_number')
ORDER BY column_name;

