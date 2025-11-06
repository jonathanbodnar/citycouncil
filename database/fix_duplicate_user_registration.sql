-- CRITICAL FIX: New User Registration Failing - "duplicate key value violates unique constraint users_pkey"
-- Error occurs when trying to register a new account

-- =============================================================================
-- PROBLEM ANALYSIS
-- =============================================================================
--
-- Error: duplicate key value violates unique constraint "users_pkey"
--
-- This means:
-- 1. auth.users creates user with ID 'abc-123'
-- 2. Trigger tries to INSERT into public.users with ID 'abc-123'
-- 3. That ID already exists in public.users
-- 4. PostgreSQL rejects the INSERT
-- 5. Registration fails
--
-- Possible causes:
-- A. User exists in public.users but not in auth.users (orphaned record)
-- B. Trigger is firing multiple times for same user
-- C. Trigger using INSERT instead of UPSERT
-- D. Failed previous registration left ghost record
--
-- =============================================================================

-- =============================================================================
-- STEP 1: Find orphaned users (in public.users but not in auth.users)
-- =============================================================================

SELECT 
  'ORPHANED USERS (public but not auth)' as issue,
  COUNT(*) as orphan_count,
  array_agg(email ORDER BY created_at DESC) FILTER (WHERE email IS NOT NULL) LIMIT 10 as sample_emails
FROM public.users pu
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users au WHERE au.id = pu.id
);

-- Show detailed orphaned records
SELECT 
  'DETAILED ORPHANS' as check_name,
  id,
  email,
  full_name,
  user_type,
  created_at,
  'This user exists in public.users but not auth.users' as issue
FROM public.users pu
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users au WHERE au.id = pu.id
)
ORDER BY created_at DESC
LIMIT 20;

-- =============================================================================
-- STEP 2: Find mismatched users (different data in auth vs public)
-- =============================================================================

SELECT 
  'MISMATCHED USERS' as check_name,
  au.id,
  au.email as auth_email,
  pu.email as public_email,
  au.created_at as auth_created,
  pu.created_at as public_created,
  CASE 
    WHEN au.email != pu.email THEN '❌ Email mismatch'
    WHEN au.created_at != pu.created_at THEN '⚠️ Timestamp mismatch'
    ELSE '✅ OK'
  END as issue
FROM auth.users au
INNER JOIN public.users pu ON au.id = pu.id
WHERE au.email != pu.email
  OR ABS(EXTRACT(EPOCH FROM (au.created_at - pu.created_at))) > 60
ORDER BY au.created_at DESC
LIMIT 10;

-- =============================================================================
-- STEP 3: Check the trigger function that creates public.users
-- =============================================================================

-- Show trigger on auth.users
SELECT 
  'AUTH.USERS TRIGGERS' as check_name,
  trigger_name,
  event_manipulation as event,
  action_timing as timing,
  action_statement as function_call
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
ORDER BY trigger_name;

-- Show the actual trigger function code
SELECT 
  'TRIGGER FUNCTION CODE' as check_name,
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%user%'
  AND routine_type = 'FUNCTION'
  AND routine_definition LIKE '%public.users%';

-- =============================================================================
-- STEP 4: THE FIX - Change INSERT to UPSERT in trigger
-- =============================================================================

-- First, find the trigger function name
DO $$
DECLARE
  func_name text;
BEGIN
  SELECT routine_name INTO func_name
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'
    AND routine_definition LIKE '%public.users%'
    AND routine_definition LIKE '%auth.uid()%'
  LIMIT 1;
  
  RAISE NOTICE 'Found trigger function: %', func_name;
END $$;

-- Drop and recreate the trigger function with UPSERT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use UPSERT (INSERT ... ON CONFLICT) instead of plain INSERT
  INSERT INTO public.users (
    id,
    email,
    full_name,
    avatar_url,
    user_type,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    'user', -- Default to 'user' type
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- STEP 5: Clean up orphaned records (OPTIONAL - USE WITH CAUTION)
-- =============================================================================

-- ⚠️ WARNING: Only run this if you're sure these are ghost records
-- This deletes users from public.users that don't exist in auth.users

/*
-- Uncomment to delete orphans
DELETE FROM public.users
WHERE id IN (
  SELECT pu.id
  FROM public.users pu
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = pu.id
  )
  AND created_at > NOW() - INTERVAL '7 days' -- Only recent orphans
);
*/

-- =============================================================================
-- STEP 6: Verify the fix
-- =============================================================================

-- Check trigger function now uses ON CONFLICT
SELECT 
  'VERIFY UPSERT IN TRIGGER' as check_name,
  routine_name,
  CASE 
    WHEN routine_definition LIKE '%ON CONFLICT%' THEN '✅ Uses UPSERT'
    WHEN routine_definition LIKE '%INSERT INTO public.users%' THEN '⚠️ Uses INSERT (may fail)'
    ELSE '❓ Unknown'
  END as upsert_check
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'handle_new_user'
  AND routine_type = 'FUNCTION';

-- Verify trigger is attached
SELECT 
  'VERIFY TRIGGER ATTACHED' as check_name,
  trigger_name,
  event_manipulation,
  action_timing,
  CASE 
    WHEN action_statement LIKE '%handle_new_user%' THEN '✅ Calls handle_new_user()'
    ELSE '❌ Wrong function'
  END as function_check
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
  AND trigger_name = 'on_auth_user_created';

-- =============================================================================
-- STEP 7: Test user registration
-- =============================================================================

-- After running this fix, test by:
-- 1. Go to /signup
-- 2. Register with a NEW email
-- 3. Should succeed without "duplicate key" error
-- 4. Check both tables:

/*
-- Check auth.users
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'your_test_email@example.com';

-- Check public.users (should have same ID)
SELECT id, email, user_type, created_at 
FROM public.users 
WHERE email = 'your_test_email@example.com';
*/

-- =============================================================================
-- EXPECTED RESULTS AFTER FIX:
-- =============================================================================
--
-- ✅ Trigger function uses UPSERT (ON CONFLICT DO UPDATE)
-- ✅ New user registration works without duplicate key error
-- ✅ If user somehow exists in public.users, it gets updated instead of failing
-- ✅ No more orphaned records
--
-- =============================================================================

-- =============================================================================
-- ROOT CAUSE EXPLANATION:
-- =============================================================================
--
-- When we modified user creation flow for talent onboarding:
-- 1. We changed from UPDATE to UPSERT in frontend code
-- 2. BUT we didn't update the database trigger
-- 3. Trigger still used plain INSERT
-- 4. If record already exists → duplicate key error
--
-- This happened because:
-- - Failed registration attempts leave auth.users record
-- - But public.users insert fails
-- - Next attempt: auth.users says "email taken"
-- - User tries different email
-- - But old ID might still exist in public.users somehow
--
-- OR:
-- - Trigger fires multiple times due to some edge case
-- - First INSERT succeeds
-- - Second INSERT fails with duplicate key
--
-- SOLUTION:
-- Change trigger to use UPSERT (INSERT ... ON CONFLICT DO UPDATE)
-- Now it works whether record exists or not!
--
-- =============================================================================

-- =============================================================================
-- SUMMARY OF CHANGES:
-- =============================================================================
--
-- Before:
-- INSERT INTO public.users (...) VALUES (...);
-- ❌ Fails if ID exists
--
-- After:
-- INSERT INTO public.users (...) VALUES (...)
-- ON CONFLICT (id) DO UPDATE SET ...
-- ✅ Works even if ID exists
--
-- =============================================================================

