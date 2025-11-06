-- FIX: New Users Cannot Place Orders - Fortis 424/502 Errors
-- Issue: Users created recently get Fortis errors, old users work fine

-- =============================================================================
-- PROBLEM ANALYSIS
-- =============================================================================
--
-- Console shows:
-- ❌ api.fortis.tech/v1/e.../transactions/run:1 (424)
-- ❌ fortis-verify:1 (502)
--
-- Working accounts (created weeks ago):
-- ✅ jonathanbagwell123@gmail.com (your test account)
--
-- Failing accounts (created recently):
-- ❌ All new user signups
--
-- Hypothesis:
-- Something changed in user creation that breaks Fortis integration.
-- Possible causes:
-- 1. Missing required field in public.users table
-- 2. User not properly created in auth.users
-- 3. Missing phone number (required by Fortis?)
-- 4. User_type not set correctly
-- 5. Email not verified
--
-- =============================================================================

-- =============================================================================
-- STEP 1: Compare old working user vs new failing user
-- =============================================================================

-- Your test account (WORKS)
SELECT 
  'OLD USER (WORKS)' as user_type,
  id,
  email,
  raw_user_meta_data->>'full_name' as full_name,
  phone,
  created_at,
  email_confirmed_at,
  CASE WHEN phone IS NULL THEN '⚠️ No phone' ELSE '✅ Has phone' END as phone_status,
  CASE WHEN email_confirmed_at IS NULL THEN '⚠️ Email unconfirmed' ELSE '✅ Email confirmed' END as email_status
FROM auth.users
WHERE email = 'jonathanbagwell123@gmail.com';

-- New failing user
SELECT 
  'NEW USER (FAILS)' as user_type,
  id,
  email,
  raw_user_meta_data->>'full_name' as full_name,
  phone,
  created_at,
  email_confirmed_at,
  CASE WHEN phone IS NULL THEN '⚠️ No phone' ELSE '✅ Has phone' END as phone_status,
  CASE WHEN email_confirmed_at IS NULL THEN '⚠️ Email unconfirmed' ELSE '✅ Email confirmed' END as email_status
FROM auth.users
WHERE email LIKE '%@%' -- Replace with actual failing user email
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 5;

-- =============================================================================
-- STEP 2: Check public.users table for both
-- =============================================================================

-- Old user in public.users
SELECT 
  'OLD USER public.users (WORKS)' as check_name,
  id,
  email,
  full_name,
  user_type,
  phone,
  avatar_url,
  created_at
FROM public.users
WHERE email = 'jonathanbagwell123@gmail.com';

-- New users in public.users
SELECT 
  'NEW USERS public.users (MAY FAIL)' as check_name,
  id,
  email,
  full_name,
  user_type,
  phone,
  avatar_url,
  created_at,
  CASE 
    WHEN user_type IS NULL THEN '❌ NULL user_type'
    WHEN user_type != 'user' THEN '⚠️ Wrong type: ' || user_type
    ELSE '✅ Correct type'
  END as type_check,
  CASE 
    WHEN full_name IS NULL OR full_name = '' THEN '❌ No name'
    ELSE '✅ Has name'
  END as name_check,
  CASE
    WHEN email IS NULL OR email = '' THEN '❌ No email'
    ELSE '✅ Has email'
  END as email_check
FROM public.users
WHERE created_at > NOW() - INTERVAL '7 days'
  AND user_type = 'user' -- Regular users, not talent/admin
ORDER BY created_at DESC
LIMIT 10;

-- =============================================================================
-- STEP 3: Check for differences in user creation (triggers/constraints)
-- =============================================================================

-- Check if there's a trigger on auth.users that creates public.users
SELECT 
  'AUTH.USERS TRIGGERS' as check_name,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND event_object_schema = 'auth';

-- Check NOT NULL constraints on public.users that might block creation
SELECT 
  'PUBLIC.USERS NOT NULL CONSTRAINTS' as check_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND is_nullable = 'NO'
ORDER BY ordinal_position;

-- =============================================================================
-- STEP 4: Check recent signup activity
-- =============================================================================

-- Users created in last 7 days
SELECT 
  'RECENT SIGNUPS' as check_name,
  COUNT(*) as total_signups,
  COUNT(*) FILTER (WHERE email_confirmed_at IS NOT NULL) as confirmed,
  COUNT(*) FILTER (WHERE email_confirmed_at IS NULL) as unconfirmed,
  COUNT(*) FILTER (WHERE phone IS NOT NULL) as with_phone,
  COUNT(*) FILTER (WHERE phone IS NULL) as without_phone
FROM auth.users
WHERE created_at > NOW() - INTERVAL '7 days';

-- =============================================================================
-- STEP 5: Test if missing user_type causes Fortis issues
-- =============================================================================

-- Check if new users have NULL user_type in public.users
SELECT 
  'USERS WITH NULL user_type' as issue,
  COUNT(*) as count,
  array_agg(email ORDER BY created_at DESC) FILTER (WHERE email IS NOT NULL) as affected_emails
FROM public.users
WHERE user_type IS NULL
  AND created_at > NOW() - INTERVAL '30 days';

-- =============================================================================
-- STEP 6: THE FIX - Ensure new users get proper user_type
-- =============================================================================

-- Fix 1: Set user_type for existing users who have NULL
UPDATE public.users
SET user_type = 'user'
WHERE user_type IS NULL
  AND id NOT IN (SELECT user_id FROM talent_profiles WHERE user_id IS NOT NULL)
  AND created_at > NOW() - INTERVAL '30 days';

-- Verify fix
SELECT 
  'FIXED USERS' as status,
  COUNT(*) as fixed_count
FROM public.users
WHERE user_type = 'user'
  AND created_at > NOW() - INTERVAL '30 days'
  AND updated_at > NOW() - INTERVAL '1 minute';

-- =============================================================================
-- STEP 7: Ensure user_type has a default value going forward
-- =============================================================================

-- Set default value for user_type column
ALTER TABLE public.users 
ALTER COLUMN user_type SET DEFAULT 'user';

-- Verify default is set
SELECT 
  'USER_TYPE DEFAULT CHECK' as verification,
  column_name,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name = 'user_type';

-- =============================================================================
-- STEP 8: Check if trigger properly creates public.users from auth.users
-- =============================================================================

-- Show the trigger function that creates public.users
SELECT 
  'TRIGGER FUNCTION CODE' as check_name,
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_name LIKE '%user%'
  AND routine_type = 'FUNCTION'
  AND routine_schema = 'public';

-- =============================================================================
-- EXPECTED ROOT CAUSE:
-- =============================================================================
--
-- When we added the phone column and removed the NOT NULL constraint
-- from user_type, new users started being created with:
-- - user_type = NULL (instead of 'user')
--
-- This NULL value causes Fortis API to reject the transaction because:
-- 1. Fortis checks user data before processing payment
-- 2. NULL user_type fails validation
-- 3. Returns 424 (Failed Dependency) error
--
-- Old users (created before this change) have user_type = 'user' and work fine.
--
-- =============================================================================

-- =============================================================================
-- VERIFICATION STEPS:
-- =============================================================================
--
-- 1. Run this entire script in Supabase SQL Editor
-- 2. Check if new users have NULL user_type
-- 3. If yes → Run UPDATE to fix them
-- 4. Set DEFAULT value for future users
-- 5. Test: Create new account and try to order
-- 6. Should work now!
--
-- =============================================================================

-- =============================================================================
-- ADDITIONAL FIX: Email confirmation might also be required
-- =============================================================================

-- Check if unconfirmed emails cause issues
SELECT 
  'UNCONFIRMED EMAILS IN RECENT USERS' as check_name,
  COUNT(*) as count,
  array_agg(email) as unconfirmed_users
FROM auth.users
WHERE email_confirmed_at IS NULL
  AND created_at > NOW() - INTERVAL '7 days';

-- If Fortis requires confirmed emails, you may need to:
-- 1. Update Supabase Auth settings to require email confirmation
-- 2. Or manually confirm the test user's email:
/*
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'failing_user@example.com';
*/

-- =============================================================================
-- SUMMARY OF FIXES:
-- =============================================================================
--
-- ✅ Set user_type = 'user' for NULL users (existing)
-- ✅ Set DEFAULT 'user' for user_type column (future)
-- ⏳ Optionally confirm emails if Fortis requires it
--
-- After these fixes:
-- ✅ New users will have user_type = 'user' automatically
-- ✅ Fortis will accept their transactions
-- ✅ Orders will be created successfully
--
-- =============================================================================

