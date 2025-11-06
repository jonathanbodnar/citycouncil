-- SAFE VERSION: Fix RLS Policies for Talent Onboarding
-- This version is safe to run multiple times

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop ALL possible existing policies (ignore errors if they don't exist)
DROP POLICY IF EXISTS "Allow user creation during onboarding" ON users;
DROP POLICY IF EXISTS "Users can access own data" ON users;
DROP POLICY IF EXISTS "Allow talent self-update" ON users;
DROP POLICY IF EXISTS "Allow authenticated user creation" ON users;
DROP POLICY IF EXISTS "Allow authenticated self-update" ON users;
DROP POLICY IF EXISTS "Allow authenticated self-select" ON users;
DROP POLICY IF EXISTS "Allow anonymous user creation for talent" ON users;

-- Create fresh policies
CREATE POLICY "Allow authenticated user creation" ON users
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow authenticated self-update" ON users
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow authenticated self-select" ON users
FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Allow anonymous user creation for talent" ON users
FOR INSERT TO anon
WITH CHECK (user_type = 'talent');

-- Verify policies were created
SELECT 
  policyname,
  cmd as permission,
  roles as for_role
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

