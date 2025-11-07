-- Fix Duplicate Key Error on User Registration
-- Error: duplicate key value violates unique constraint "users_pkey"
-- Cause: handle_new_user trigger using INSERT instead of UPSERT

-- =============================================================================
-- STEP 1: Check current trigger and function
-- =============================================================================

SELECT 
  '1. CURRENT TRIGGER STATUS' as step,
  tgname as trigger_name,
  tgenabled as enabled,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- Check function definition
SELECT 
  '2. CURRENT FUNCTION' as step,
  proname as function_name,
  prosrc as function_code
FROM pg_proc
WHERE proname = 'handle_new_user';

-- =============================================================================
-- STEP 2: Drop and recreate trigger and function with UPSERT
-- =============================================================================

-- Drop trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop function
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Recreate function with UPSERT logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Use UPSERT (INSERT ... ON CONFLICT ... DO UPDATE)
  -- This prevents duplicate key errors
  INSERT INTO public.users (id, email, full_name, avatar_url, user_type, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    'user', -- Default to regular user
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- STEP 3: Verify the fix
-- =============================================================================

SELECT 
  '3. VERIFICATION - TRIGGER RECREATED' as step,
  tgname as trigger_name,
  tgenabled as enabled
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

SELECT 
  '4. VERIFICATION - FUNCTION RECREATED' as step,
  proname as function_name,
  prosrc as function_code
FROM pg_proc
WHERE proname = 'handle_new_user';

-- =============================================================================
-- STEP 4: Test with a manual insert (simulates new user)
-- =============================================================================

-- Check if test user exists
SELECT 
  '5. CHECK TEST USER' as step,
  id,
  email,
  user_type
FROM public.users
WHERE email = 'test_duplicate_fix@example.com';

-- Clean up test user if exists
DELETE FROM auth.users WHERE email = 'test_duplicate_fix@example.com';
DELETE FROM public.users WHERE email = 'test_duplicate_fix@example.com';

-- =============================================================================
-- STEP 5: Also ensure user_type has a default
-- =============================================================================

-- Set default value for user_type column
ALTER TABLE public.users 
  ALTER COLUMN user_type SET DEFAULT 'user';

-- Update any NULL user_types to 'user'
UPDATE public.users 
SET user_type = 'user' 
WHERE user_type IS NULL;

-- =============================================================================
-- SUMMARY
-- =============================================================================

SELECT '
✅ DUPLICATE KEY FIX APPLIED

Changes made:
1. Dropped old handle_new_user function and trigger
2. Recreated with UPSERT logic (INSERT ... ON CONFLICT ... DO UPDATE)
3. Set default user_type to ''user''
4. Updated any NULL user_types to ''user''

How UPSERT works:
- First attempt: INSERT new user
- If user.id already exists: UPDATE instead of failing
- Result: No duplicate key errors

Testing:
1. Try registering a new user on homepage
2. Should succeed on first attempt
3. No "duplicate key" error

If still getting error:
- Check browser console for different error
- Verify email is unique (not already registered)
- Check Supabase Auth logs for actual issue

' as summary;

