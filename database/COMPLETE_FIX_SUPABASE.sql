-- COMPLETE DIAGNOSTIC AND FIX FOR SUPABASE DASHBOARD
-- Copy and run this entire script in Supabase Dashboard SQL Editor

-- =============================================================================
-- STEP 1: DIAGNOSTIC - Check current state
-- =============================================================================

-- Check for triggers on users table
SELECT 
  'TRIGGERS ON USERS TABLE' as check_name,
  trigger_name,
  event_manipulation as event,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND event_object_schema = 'public';

-- Check user_type column definition
SELECT 
  'USER_TYPE COLUMN INFO' as check_name,
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users' 
  AND table_schema = 'public'
  AND column_name = 'user_type';

-- Check current RLS policies
SELECT 
  'CURRENT RLS POLICIES' as check_name,
  policyname,
  cmd as permissions,
  roles
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- =============================================================================
-- STEP 2: FIX - Remove defaults and fix policies
-- =============================================================================

-- Remove any default value on user_type
ALTER TABLE public.users 
ALTER COLUMN user_type DROP DEFAULT;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Allow user creation during onboarding" ON users;
DROP POLICY IF EXISTS "Users can access own data" ON users;
DROP POLICY IF EXISTS "Allow talent self-update" ON users;
DROP POLICY IF EXISTS "Allow authenticated user creation" ON users;
DROP POLICY IF EXISTS "Allow authenticated self-update" ON users;
DROP POLICY IF EXISTS "Allow authenticated self-select" ON users;
DROP POLICY IF EXISTS "Allow anonymous user creation for talent" ON users;
DROP POLICY IF EXISTS "Allow authenticated users full access to own record" ON users;

-- Create the correct policy for UPSERT (FOR ALL is key!)
CREATE POLICY "Allow authenticated users full access to own record" ON users
FOR ALL
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Anonymous policy for edge cases
CREATE POLICY "Allow anonymous user creation for talent" ON users
FOR INSERT
TO anon
WITH CHECK (user_type = 'talent');

-- =============================================================================
-- STEP 3: VERIFY - Check new policies
-- =============================================================================

SELECT 
  'NEW RLS POLICIES (SHOULD SEE 2)' as check_name,
  policyname,
  cmd as permissions,
  roles
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- =============================================================================
-- STEP 4: TEST - Try manual UPSERT
-- =============================================================================

-- Test if we can UPSERT with user_type='talent'
DO $$
DECLARE
  test_id uuid := gen_random_uuid();
  test_email text := 'manual-test-' || floor(random() * 100000)::text || '@test.com';
  result_type text;
BEGIN
  -- Try UPSERT
  INSERT INTO public.users (id, email, user_type, full_name)
  VALUES (test_id, test_email, 'talent', 'Manual Test User')
  ON CONFLICT (id) DO UPDATE 
  SET user_type = 'talent';
  
  -- Check what was created
  SELECT user_type INTO result_type FROM public.users WHERE id = test_id;
  
  -- Report result
  IF result_type = 'talent' THEN
    RAISE NOTICE '✓ TEST PASSED: User created with user_type=talent';
  ELSE
    RAISE NOTICE '✗ TEST FAILED: User created with user_type=% (expected talent)', result_type;
  END IF;
  
  -- Clean up
  DELETE FROM public.users WHERE id = test_id;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ TEST FAILED WITH ERROR: %', SQLERRM;
END $$;

-- =============================================================================
-- FINAL CHECK: Show summary
-- =============================================================================

SELECT 
  'SUMMARY' as status,
  'If you see ✓ TEST PASSED above, onboarding should now work!' as message
UNION ALL
SELECT 
  'NEXT STEP' as status,
  'Try registering a new talent at the onboarding link' as message;

