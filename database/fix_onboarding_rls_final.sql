-- Fix RLS policies for talent onboarding completion
-- Issue: After MFA verification, onboarding completion fails due to RLS

-- 1. Check current RLS policies on users table
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

-- 2. Drop existing policies that might be conflicting
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;

-- 3. Create new, working policies
-- Allow users to read their own data
CREATE POLICY "Users can read own data"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Allow users to insert their own record during signup
CREATE POLICY "Users can insert own record"
  ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own record
CREATE POLICY "Users can update own record"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. CRITICAL: Also allow the trigger to insert on behalf of auth
-- This is needed for the handle_new_user() trigger
CREATE POLICY "Allow trigger to insert users"
  ON public.users
  FOR INSERT
  WITH CHECK (true);

-- 5. Verify RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 6. Verify the policies were created
SELECT 
  policyname,
  cmd,
  roles,
  'Created successfully' as status
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

