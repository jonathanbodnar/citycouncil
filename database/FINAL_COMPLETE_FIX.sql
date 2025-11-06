-- FINAL COMPLETE FIX: All New User Issues
-- Run this ENTIRE script in one go in Supabase SQL Editor

-- =============================================================================
-- ISSUE SUMMARY:
-- =============================================================================
-- 1. Registration: "duplicate key value violates unique constraint users_pkey"
-- 2. Orders: john@example.com works, but jonathanbagwell23@gmail.com fails (424)
-- 3. Root cause: Trigger still using INSERT instead of UPSERT
-- 4. Root cause: New users have user_type = NULL (causes Fortis 424)
--
-- =============================================================================

-- =============================================================================
-- FIX #1: Drop and recreate trigger with UPSERT (fixes duplicate key)
-- =============================================================================

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop old function if exists
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create NEW function with UPSERT and DEFAULT user_type
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use UPSERT to avoid duplicate key errors
  -- Always set user_type to 'user' for new signups
  INSERT INTO public.users (
    id,
    email,
    full_name,
    avatar_url,
    user_type,
    phone,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    'user', -- ⭐ ALWAYS 'user' for new signups
    NEW.phone,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
    phone = COALESCE(EXCLUDED.phone, public.users.phone),
    updated_at = NOW()
    -- NOTE: We DON'T update user_type on conflict (preserve existing value)
  WHERE public.users.user_type IS NULL; -- Only update if current user_type is NULL
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- FIX #2: Set DEFAULT value for user_type column
-- =============================================================================

-- Ensure user_type defaults to 'user' for any direct inserts
ALTER TABLE public.users 
ALTER COLUMN user_type SET DEFAULT 'user';

-- =============================================================================
-- FIX #3: Update EXISTING users with NULL user_type
-- =============================================================================

-- Fix all existing users who have NULL user_type
-- (Excludes talent who should have user_type from talent onboarding)
UPDATE public.users
SET user_type = 'user'
WHERE user_type IS NULL
  AND id NOT IN (
    SELECT user_id 
    FROM talent_profiles 
    WHERE user_id IS NOT NULL
  );

-- =============================================================================
-- FIX #4: Fix jonathanbagwell23@gmail.com specifically
-- =============================================================================

-- Ensure this user has correct user_type
UPDATE public.users
SET user_type = 'user'
WHERE email = 'jonathanbagwell23@gmail.com'
  AND user_type IS NULL;

-- =============================================================================
-- VERIFICATION: Check if fixes were applied
-- =============================================================================

-- 1. Check trigger exists
SELECT 
  '✅ Step 1: TRIGGER CHECK' as step,
  trigger_name,
  event_manipulation,
  action_timing,
  CASE 
    WHEN trigger_name = 'on_auth_user_created' THEN '✅ Trigger exists'
    ELSE '❌ Trigger missing'
  END as status
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
  AND trigger_name = 'on_auth_user_created';

-- 2. Check function uses UPSERT
SELECT 
  '✅ Step 2: UPSERT CHECK' as step,
  routine_name,
  CASE 
    WHEN routine_definition LIKE '%ON CONFLICT%' THEN '✅ Uses UPSERT'
    WHEN routine_definition LIKE '%INSERT INTO public.users%' AND routine_definition NOT LIKE '%ON CONFLICT%' THEN '❌ Uses plain INSERT (BAD)'
    ELSE '❓ Cannot determine'
  END as upsert_status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'handle_new_user'
  AND routine_type = 'FUNCTION';

-- 3. Check DEFAULT value
SELECT 
  '✅ Step 3: DEFAULT CHECK' as step,
  column_name,
  column_default,
  CASE 
    WHEN column_default LIKE '%user%' THEN '✅ Default = user'
    WHEN column_default IS NULL THEN '❌ No default'
    ELSE '⚠️ Other: ' || column_default
  END as default_status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name = 'user_type';

-- 4. Check for remaining NULL user_types
SELECT 
  '✅ Step 4: NULL CHECK' as step,
  COUNT(*) as null_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ No NULL user_types'
    ELSE '❌ ' || COUNT(*) || ' users still have NULL user_type'
  END as status,
  array_agg(email ORDER BY created_at DESC) FILTER (WHERE email IS NOT NULL) as affected_emails
FROM public.users
WHERE user_type IS NULL;

-- 5. Check jonathanbagwell23@gmail.com specifically
SELECT 
  '✅ Step 5: BAGWELL CHECK' as step,
  id,
  email,
  user_type,
  full_name,
  CASE 
    WHEN user_type = 'user' THEN '✅ user_type = user (GOOD)'
    WHEN user_type IS NULL THEN '❌ user_type = NULL (BAD - Causes Fortis 424)'
    ELSE '⚠️ user_type = ' || user_type
  END as status
FROM public.users
WHERE email = 'jonathanbagwell23@gmail.com';

-- 6. Compare with working user john@example.com
SELECT 
  '✅ Step 6: JOHN CHECK' as step,
  id,
  email,
  user_type,
  full_name,
  CASE 
    WHEN user_type = 'user' THEN '✅ user_type = user (GOOD)'
    WHEN user_type IS NULL THEN '❌ user_type = NULL (BAD)'
    ELSE '⚠️ user_type = ' || user_type
  END as status
FROM public.users
WHERE email = 'john@example.com';

-- =============================================================================
-- FINAL SUMMARY
-- =============================================================================

SELECT 
  '🎯 FINAL STATUS' as check_name,
  (SELECT COUNT(*) FROM information_schema.triggers 
   WHERE event_object_table = 'users' 
   AND trigger_name = 'on_auth_user_created') as trigger_exists,
  (SELECT CASE WHEN routine_definition LIKE '%ON CONFLICT%' THEN 'YES' ELSE 'NO' END
   FROM information_schema.routines 
   WHERE routine_name = 'handle_new_user' 
   LIMIT 1) as uses_upsert,
  (SELECT COUNT(*) FROM public.users WHERE user_type IS NULL) as null_user_types,
  (SELECT user_type FROM public.users WHERE email = 'jonathanbagwell23@gmail.com') as bagwell_user_type,
  CASE 
    WHEN (SELECT COUNT(*) FROM public.users WHERE user_type IS NULL) = 0 
      AND (SELECT routine_definition FROM information_schema.routines WHERE routine_name = 'handle_new_user' LIMIT 1) LIKE '%ON CONFLICT%'
      AND (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created') > 0
    THEN '✅ ALL FIXES APPLIED SUCCESSFULLY'
    ELSE '⚠️ SOME ISSUES REMAIN - Check steps above'
  END as overall_status;

-- =============================================================================
-- TESTING INSTRUCTIONS
-- =============================================================================

SELECT '
🧪 TESTING STEPS:

1. ✅ REGISTRATION TEST:
   - Go to /signup
   - Register with NEW email
   - Should succeed (no duplicate key error)

2. ✅ ORDER TEST (jonathanbagwell23):
   - Login as jonathanbagwell23@gmail.com
   - Try to order from ANY talent
   - Should work (no Fortis 424 error)

3. ✅ VERIFY IN DATABASE:
   SELECT email, user_type FROM public.users 
   WHERE email = ''your_new_test_email@example.com'';
   - Should show: user_type = ''user'' (not NULL)

📊 EXPECTED RESULTS:
- ✅ Trigger: on_auth_user_created exists
- ✅ Function: handle_new_user uses UPSERT (ON CONFLICT)
- ✅ Default: user_type defaults to ''user''
- ✅ NULL count: 0 (no users with NULL user_type)
- ✅ bagwell: user_type = ''user''
- ✅ john: user_type = ''user''

🎯 WHY JOHN WORKS BUT BAGWELL DOESNT:
Old user (john): Created before bug → user_type = ''user'' → ✅ Works
New user (bagwell): Created after bug → user_type = NULL → ❌ Fortis 424

🔧 WHAT THIS FIX DOES:
1. Changes trigger from INSERT to UPSERT (no more duplicate key)
2. Ensures user_type always = ''user'' for new signups
3. Fixes existing users with NULL user_type
4. Sets DEFAULT so direct inserts also work

' as instructions;

-- =============================================================================
-- IF STILL FAILING AFTER THIS:
-- =============================================================================
-- 
-- 1. Check if script actually ran successfully (no errors)
-- 2. Verify ALL 6 verification checks pass above
-- 3. Try creating a brand new test account
-- 4. Check browser console for different error
-- 5. Share the new error message
--
-- =============================================================================

