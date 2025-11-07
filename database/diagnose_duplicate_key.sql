-- Deep Diagnostic for Duplicate Key Error
-- Error persists after UPSERT fix - need to find root cause

-- =============================================================================
-- STEP 1: Verify trigger is using UPSERT
-- =============================================================================

SELECT 
  '1. TRIGGER DEFINITION' as check_name,
  pg_get_triggerdef(oid) as full_trigger_definition
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

SELECT 
  '2. FUNCTION SOURCE CODE' as check_name,
  prosrc as function_code
FROM pg_proc
WHERE proname = 'handle_new_user';

-- =============================================================================
-- STEP 2: Check if there are OTHER triggers on auth.users
-- =============================================================================

SELECT 
  '3. ALL TRIGGERS ON AUTH.USERS' as check_name,
  tgname as trigger_name,
  tgenabled as enabled,
  pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass
ORDER BY tgname;

-- =============================================================================
-- STEP 3: Check for ghost users in public.users but not in auth.users
-- =============================================================================

SELECT 
  '4. GHOST USERS IN PUBLIC.USERS' as check_name,
  u.id,
  u.email,
  u.user_type,
  u.created_at,
  CASE 
    WHEN au.id IS NULL THEN '❌ NOT IN AUTH.USERS - GHOST USER'
    ELSE '✅ Valid user'
  END as status
FROM public.users u
LEFT JOIN auth.users au ON u.id = au.id
WHERE au.id IS NULL
ORDER BY u.created_at DESC
LIMIT 20;

-- Count ghost users
SELECT 
  '5. GHOST USER COUNT' as check_name,
  COUNT(*) as ghost_users,
  'These users exist in public.users but not auth.users' as description
FROM public.users u
LEFT JOIN auth.users au ON u.id = au.id
WHERE au.id IS NULL;

-- =============================================================================
-- STEP 4: Check recent failed registration attempts
-- =============================================================================

-- Look for users created in last hour
SELECT 
  '6. RECENT USERS (LAST HOUR)' as check_name,
  au.id,
  au.email,
  au.created_at as auth_created,
  u.created_at as public_created,
  CASE 
    WHEN u.id IS NULL THEN '❌ NOT IN PUBLIC.USERS'
    WHEN au.created_at > u.created_at THEN '⚠️ PUBLIC CREATED BEFORE AUTH (WEIRD)'
    ELSE '✅ Normal'
  END as sync_status
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE au.created_at > NOW() - INTERVAL '1 hour'
ORDER BY au.created_at DESC;

-- =============================================================================
-- STEP 5: Test the handle_new_user function directly
-- =============================================================================

-- Create a test record to simulate auth.users INSERT
DO $$
DECLARE
  test_id UUID := gen_random_uuid();
  test_email TEXT := 'diagnostic_test_' || floor(random() * 10000) || '@example.com';
BEGIN
  -- Try inserting into auth.users (this will trigger handle_new_user)
  INSERT INTO auth.users (
    id, 
    email, 
    encrypted_password, 
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    test_id,
    test_email,
    crypt('test123', gen_salt('bf')),
    NOW(),
    '{"full_name": "Test User"}'::jsonb,
    NOW(),
    NOW()
  );
  
  RAISE NOTICE 'Test user created successfully: %', test_email;
  
  -- Check if public.users was created
  IF EXISTS (SELECT 1 FROM public.users WHERE id = test_id) THEN
    RAISE NOTICE '✅ Trigger worked: public.users record created';
  ELSE
    RAISE NOTICE '❌ Trigger FAILED: public.users record NOT created';
  END IF;
  
  -- Cleanup
  DELETE FROM auth.users WHERE id = test_id;
  DELETE FROM public.users WHERE id = test_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR during test: %', SQLERRM;
    -- Try to cleanup
    DELETE FROM auth.users WHERE email = test_email;
    DELETE FROM public.users WHERE email = test_email;
END $$;

-- =============================================================================
-- STEP 6: Check for RLS blocking INSERT into public.users
-- =============================================================================

SELECT 
  '7. RLS POLICIES ON PUBLIC.USERS' as check_name,
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users'
  AND schemaname = 'public'
ORDER BY policyname;

-- =============================================================================
-- STEP 7: The nuclear option - disable and re-enable trigger
-- =============================================================================

-- Disable trigger
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

-- Re-enable trigger
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

-- Verify it's enabled
SELECT 
  '8. TRIGGER ENABLED CHECK' as check_name,
  tgname,
  CASE tgenabled
    WHEN 'O' THEN '✅ Enabled'
    WHEN 'D' THEN '❌ Disabled'
    ELSE '❓ Unknown: ' || tgenabled
  END as status
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- =============================================================================
-- DIAGNOSTIC SUMMARY
-- =============================================================================

SELECT '
🔍 DIAGNOSTIC COMPLETE

Possible causes for duplicate key error:

1. TRIGGER NOT UPDATED
   - Check "FUNCTION SOURCE CODE" above
   - Should contain "ON CONFLICT (id) DO UPDATE"
   - If it says "INSERT INTO" only = OLD CODE STILL THERE

2. GHOST USERS
   - Check "GHOST USERS" count
   - These block new registrations with same ID
   - Solution: Clean up ghost users

3. MULTIPLE TRIGGERS
   - Check "ALL TRIGGERS ON AUTH.USERS"
   - If you see duplicate triggers = conflict
   - Solution: Drop duplicate triggers

4. RLS BLOCKING INSERT
   - Check "RLS POLICIES" 
   - Overly restrictive policy = INSERT fails
   - Solution: Update RLS policy

5. TRIGGER DISABLED
   - Check "TRIGGER ENABLED CHECK"
   - Should show "Enabled"
   - Solution: Already re-enabled above

NEXT STEPS:
1. Review output above
2. Share "FUNCTION SOURCE CODE" section
3. Check if it contains ON CONFLICT
4. If not, trigger didnt actually update

' as diagnostic_summary;

