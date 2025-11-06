-- Fix RLS Policies to Allow UPSERT During Talent Onboarding
-- This fixes the "Failed to create/update user record" error

-- Enable RLS on users table (if not already enabled)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop all existing user policies
DROP POLICY IF EXISTS "Allow user creation during onboarding" ON users;
DROP POLICY IF EXISTS "Users can access own data" ON users;
DROP POLICY IF EXISTS "Allow talent self-update" ON users;
DROP POLICY IF EXISTS "Allow authenticated user creation" ON users;
DROP POLICY IF EXISTS "Allow authenticated self-upsert" ON users;

-- ============================================================================
-- POLICY 1: Allow authenticated users to INSERT their own user record
-- ============================================================================
-- This handles the initial user creation during signup
CREATE POLICY "Allow authenticated user creation" ON users
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- POLICY 2: Allow authenticated users to UPDATE their own user record
-- ============================================================================
-- This handles UPSERT when user already exists
CREATE POLICY "Allow authenticated self-update" ON users
FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- POLICY 3: Allow authenticated users to SELECT their own data
-- ============================================================================
CREATE POLICY "Allow authenticated self-select" ON users
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

-- ============================================================================
-- POLICY 4: Allow anonymous INSERT for onboarding (edge case)
-- ============================================================================
-- This is needed if user somehow isn't authenticated yet
CREATE POLICY "Allow anonymous user creation for talent" ON users
FOR INSERT 
TO anon
WITH CHECK (user_type = 'talent');

-- ============================================================================
-- Verification: Check all policies are created
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- ============================================================================
-- Test Query: Verify policies work
-- ============================================================================
-- Run this as authenticated user to test:
-- SELECT * FROM users WHERE id = auth.uid();

