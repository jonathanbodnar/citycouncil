-- CORRECT FIX: Use FOR ALL policy for UPSERT to work
-- The issue is that UPSERT needs a single policy with ALL permissions

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Allow user creation during onboarding" ON users;
DROP POLICY IF EXISTS "Users can access own data" ON users;
DROP POLICY IF EXISTS "Allow talent self-update" ON users;
DROP POLICY IF EXISTS "Allow authenticated user creation" ON users;
DROP POLICY IF EXISTS "Allow authenticated self-update" ON users;
DROP POLICY IF EXISTS "Allow authenticated self-select" ON users;
DROP POLICY IF EXISTS "Allow anonymous user creation for talent" ON users;
DROP POLICY IF EXISTS "Allow authenticated users full access to own record" ON users;

-- =============================================================================
-- THE FIX: Use FOR ALL instead of separate INSERT/UPDATE/SELECT
-- =============================================================================
-- UPSERT requires a policy that grants ALL permissions (INSERT, UPDATE, SELECT)
-- Separate policies don't work correctly for UPSERT operations

CREATE POLICY "Allow authenticated users full access to own record" ON users
FOR ALL
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Keep anonymous INSERT for talent onboarding (edge case)
CREATE POLICY "Allow anonymous user creation for talent" ON users
FOR INSERT
TO anon
WITH CHECK (user_type = 'talent');

-- =============================================================================
-- Verify policies
-- =============================================================================
SELECT 
  policyname,
  cmd as permissions,
  roles as applies_to,
  CASE 
    WHEN cmd = 'ALL' THEN '✓ Allows UPSERT'
    ELSE '✗ Does not allow UPSERT'
  END as upsert_support
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

