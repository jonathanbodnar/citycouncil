-- CRITICAL FIX: New User Registration & Ordering
-- Run this ENTIRE script in Supabase SQL Editor

-- =============================================================================
-- FIX #1: Set user_type for existing users with NULL
-- =============================================================================

-- Update all users who have NULL user_type to 'user'
-- (Excludes talent, who should keep their user_type from talent_profiles)
UPDATE public.users
SET user_type = 'user'
WHERE user_type IS NULL
  AND id NOT IN (
    SELECT user_id 
    FROM talent_profiles 
    WHERE user_id IS NOT NULL
  );

-- Verify fix
SELECT 
  'Users Fixed (user_type was NULL)' as status,
  COUNT(*) as count
FROM public.users
WHERE updated_at > NOW() - INTERVAL '5 seconds'
  AND user_type = 'user';

-- =============================================================================
-- FIX #2: Set DEFAULT value for user_type column
-- =============================================================================

-- All new users will automatically get user_type = 'user'
ALTER TABLE public.users 
ALTER COLUMN user_type SET DEFAULT 'user';

-- Verify default is set
SELECT 
  'DEFAULT Value Check' as status,
  column_name,
  column_default,
  CASE 
    WHEN column_default IS NOT NULL THEN '✅ Default set'
    ELSE '❌ No default'
  END as result
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name = 'user_type';

-- =============================================================================
-- FIX #3: Change trigger to use UPSERT instead of INSERT
-- =============================================================================

-- Drop and recreate the trigger function with UPSERT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use UPSERT to avoid duplicate key errors
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
    'user', -- Always default to 'user' type
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

-- Ensure trigger exists and is attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Check trigger is attached
SELECT 
  '✅ TRIGGER CHECK' as status,
  trigger_name,
  event_manipulation as event,
  action_timing as timing
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
  AND trigger_name = 'on_auth_user_created';

-- Check for any remaining NULL user_types
SELECT 
  'REMAINING NULL user_types' as check_name,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ All users have user_type'
    ELSE '⚠️ Some users still NULL'
  END as result
FROM public.users
WHERE user_type IS NULL;

-- =============================================================================
-- SUMMARY
-- =============================================================================

SELECT '
🎯 FIXES APPLIED:
1. ✅ Updated existing users: user_type = ''user'' (was NULL)
2. ✅ Set DEFAULT ''user'' for user_type column
3. ✅ Changed trigger to use UPSERT (prevents duplicate key errors)

🧪 TESTING:
1. Register new user → Should work (no duplicate key error)
2. New user places order → Should work (no Fortis 424 error)
3. Order shows in My Orders → Should work

📊 WHAT WAS FIXED:
- Old users (created weeks ago): Already working ✅
- New users (created recently): Fixed user_type NULL → ✅
- Future users: Will auto-get user_type=''user'' → ✅
- Registration: No more duplicate key errors → ✅

🔴 IF STILL BROKEN:
Check browser console for new errors and report them.
' as summary;

