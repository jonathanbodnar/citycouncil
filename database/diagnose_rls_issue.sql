-- Diagnose RLS Issue - Why is UPSERT Still Failing?

-- =============================================================================
-- Check 1: What policies exist on users table?
-- =============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- =============================================================================
-- Check 2: Is RLS enabled?
-- =============================================================================
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'users' AND schemaname = 'public';

-- =============================================================================
-- Check 3: Can we manually test UPSERT as authenticated user?
-- =============================================================================
-- This simulates what the onboarding code is trying to do
-- Replace 'test-user-id' with an actual auth.users id

-- First, check if you can INSERT
-- INSERT INTO public.users (id, email, user_type, full_name)
-- VALUES ('test-user-id', 'test@example.com', 'talent', 'Test User')
-- ON CONFLICT (id) DO NOTHING;

-- Then check if you can UPSERT
-- INSERT INTO public.users (id, email, user_type, full_name)
-- VALUES ('test-user-id', 'test@example.com', 'talent', 'Test User Updated')
-- ON CONFLICT (id) DO UPDATE 
-- SET email = EXCLUDED.email, user_type = EXCLUDED.user_type, full_name = EXCLUDED.full_name;

-- =============================================================================
-- Check 4: Are there conflicting policies?
-- =============================================================================
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN permissive = 'PERMISSIVE' THEN 'Allows'
    ELSE 'Restricts'
  END as policy_type
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY cmd, policyname;

-- =============================================================================
-- Check 5: Does the users table have the correct structure?
-- =============================================================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- =============================================================================
-- SOLUTION: Try a different approach - use ALL instead of separate INSERT/UPDATE
-- =============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated user creation" ON users;
DROP POLICY IF EXISTS "Allow authenticated self-update" ON users;
DROP POLICY IF EXISTS "Allow authenticated self-select" ON users;

-- Create a single comprehensive policy for authenticated users
CREATE POLICY "Allow authenticated users full access to own record" ON users
FOR ALL
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Keep anonymous INSERT for edge cases
DROP POLICY IF EXISTS "Allow anonymous user creation for talent" ON users;
CREATE POLICY "Allow anonymous user creation for talent" ON users
FOR INSERT TO anon
WITH CHECK (user_type = 'talent');

-- Verify new policies
SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'users';

