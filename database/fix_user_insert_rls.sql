-- FIX: Allow newly authenticated users to insert their own user record
-- The issue: After signUp, user is 'authenticated' not 'anon', so they can't insert
-- Solution: Allow authenticated users to insert their OWN record (auth.uid() = id)

-- Drop the old anon-only policy
DROP POLICY IF EXISTS "Allow user creation during onboarding" ON users;

-- Create new policy allowing authenticated users to insert their own record
CREATE POLICY "Allow authenticated user self-insert" ON users
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

-- Keep the existing policies for select/update
-- (These should already exist from previous migrations)

-- Verify all user table policies
-- You should see:
-- 1. "Allow authenticated user self-insert" - for INSERT (just created)
-- 2. "Users can access own data" - for ALL (existing)
-- 3. "Allow talent self-update" - for UPDATE (existing)

-- To check current policies, run:
-- SELECT * FROM pg_policies WHERE tablename = 'users';

