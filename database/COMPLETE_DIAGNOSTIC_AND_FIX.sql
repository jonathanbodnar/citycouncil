-- COMPLETE DIAGNOSTIC AND FIX FOR TALENT ONBOARDING
-- Run this entire script in Supabase Dashboard SQL Editor

-- =============================================================================
-- DIAGNOSTIC PHASE
-- =============================================================================

\echo '===== CHECKING TRIGGERS ON USERS TABLE ====='
SELECT 
  trigger_name,
  event_manipulation as event,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND event_object_schema = 'public';

\echo ''
\echo '===== CHECKING user_type COLUMN DEFINITION ====='
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users' 
  AND table_schema = 'public'
  AND column_name = 'user_type';

\echo ''
\echo '===== CHECKING CURRENT RLS POLICIES ====='
SELECT 
  policyname,
  cmd as permissions,
  roles,
  qual as using_clause,
  with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

\echo ''
\echo '===== CHECKING IF RLS IS ENABLED ====='
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'users' AND schemaname = 'public';

-- =============================================================================
-- FIX PHASE
-- =============================================================================

\echo ''
\echo '===== REMOVING user_type DEFAULT (if exists) ====='
ALTER TABLE public.users 
ALTER COLUMN user_type DROP DEFAULT;

\echo ''
\echo '===== FIXING RLS POLICIES ====='

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Allow user creation during onboarding" ON users;
DROP POLICY IF EXISTS "Users can access own data" ON users;
DROP POLICY IF EXISTS "Allow talent self-update" ON users;
DROP POLICY IF EXISTS "Allow authenticated user creation" ON users;
DROP POLICY IF EXISTS "Allow authenticated self-update" ON users;
DROP POLICY IF EXISTS "Allow authenticated self-select" ON users;
DROP POLICY IF EXISTS "Allow anonymous user creation for talent" ON users;
DROP POLICY IF EXISTS "Allow authenticated users full access to own record" ON users;

-- Create the correct policy for UPSERT
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

\echo ''
\echo '===== VERIFICATION: New Policies ====='
SELECT 
  policyname,
  cmd as permissions,
  roles
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- =============================================================================
-- TEST PHASE
-- =============================================================================

\echo ''
\echo '===== TESTING: Can we manually UPSERT with talent type? ====='
DO $$
DECLARE
  test_id uuid := gen_random_uuid();
  test_email text := 'manual-test-' || floor(random() * 100000)::text || '@test.com';
BEGIN
  -- Try UPSERT
  INSERT INTO public.users (id, email, user_type, full_name)
  VALUES (test_id, test_email, 'talent', 'Manual Test')
  ON CONFLICT (id) DO UPDATE 
  SET user_type = 'talent'
  RETURNING id, email, user_type;
  
  -- Check what was created
  RAISE NOTICE 'Test user created with email: % and user_type: talent', test_email;
  
  -- Clean up
  DELETE FROM public.users WHERE id = test_id;
  RAISE NOTICE 'Test user deleted';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Test failed with error: %', SQLERRM;
END $$;

\echo ''
\echo '===== SUMMARY ====='
\echo 'If you see "Test user created" above, the fix is working!'
\echo 'If you see "Test failed", there is still an issue blocking UPSERT.'
\echo ''
\echo 'Next steps:'
\echo '1. Look at the test result above'
\echo '2. If successful, try registering again at the onboarding link'
\echo '3. If failed, share the error message'

