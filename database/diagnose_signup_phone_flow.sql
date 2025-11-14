-- Diagnose: Why phone numbers aren't being saved during user registration

-- 1. Check the handle_new_user trigger (this runs BEFORE the UPSERT)
SELECT 
  '🔧 HANDLE_NEW_USER TRIGGER' as check,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND trigger_name LIKE '%new_user%';

-- 2. Check all triggers on users table
SELECT 
  '🔧 ALL TRIGGERS ON USERS TABLE' as check,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users'
ORDER BY action_timing, event_manipulation;

-- 3. Show the handle_new_user function (if it exists)
SELECT 
  '📝 HANDLE_NEW_USER FUNCTION' as check,
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_name LIKE '%handle_new_user%';

-- 4. Check what columns the UPSERT is trying to set
SELECT 
  '📋 USERS TABLE COLUMNS' as check,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('id', 'email', 'full_name', 'user_type', 'phone', 'sms_subscribed', 'sms_subscribed_at', 'user_tags')
ORDER BY ordinal_position;

-- 5. Test: What happens if we manually insert with a phone?
-- (This won't actually insert, just shows what WOULD happen)
EXPLAIN (VERBOSE, FORMAT JSON)
INSERT INTO users (id, email, full_name, user_type, phone, sms_subscribed)
VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'test@example.com',
  'Test User',
  'user',
  '+15551234567',
  true
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  user_type = EXCLUDED.user_type,
  phone = EXCLUDED.phone,
  sms_subscribed = EXCLUDED.sms_subscribed;

-- 6. Check recent auth.users to see if phone is in metadata
SELECT 
  '📱 RECENT AUTH.USERS (last 5)' as check,
  id,
  email,
  raw_user_meta_data->>'phone_number' as phone_in_metadata,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 7. Check recent public.users to see if phone is in table
SELECT 
  '👤 RECENT PUBLIC.USERS (last 5)' as check,
  id,
  email,
  phone as phone_in_table,
  sms_subscribed,
  user_tags,
  created_at
FROM users
ORDER BY created_at DESC
LIMIT 5;

-- 8. THE SMOKING GUN: Show users where phone is in auth but NOT in public
SELECT 
  '🚨 PHONE IN AUTH BUT NOT IN PUBLIC.USERS' as issue,
  au.id,
  au.email,
  au.raw_user_meta_data->>'full_name' as full_name,
  au.raw_user_meta_data->>'phone_number' as phone_in_auth,
  pu.phone as phone_in_public,
  au.created_at,
  CASE 
    WHEN pu.phone IS NULL OR pu.phone = '' THEN '❌ PHONE NOT SAVED'
    ELSE '✅ Phone saved correctly'
  END as status
FROM auth.users au
LEFT JOIN users pu ON au.id = pu.id
WHERE au.created_at > NOW() - INTERVAL '7 days'
ORDER BY au.created_at DESC;

-- 9. Check if the UPSERT trigger (auto_subscribe_sms) is working
SELECT 
  '🔧 AUTO_SUBSCRIBE_SMS TRIGGERS' as check,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%auto_subscribe%';

-- 10. Show the auto_subscribe_sms function definition
SELECT 
  '📝 AUTO_SUBSCRIBE_SMS FUNCTION' as check,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'auto_subscribe_sms';

