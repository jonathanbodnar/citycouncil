-- FIX USERS TABLE RLS FOR LOGIN
-- The issue: authenticated users can't INSERT their own record when profile doesn't exist
-- This happens when auth.users exists but public.users doesn't (e.g., after trigger failure)

-- First, check current policies
SELECT policyname, cmd, roles::text 
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public';

-- Drop and recreate policies to ensure proper access

-- 1. Service role full access (for triggers and admin)
DROP POLICY IF EXISTS "Allow service role full access" ON public.users;
CREATE POLICY "Allow service role full access"
  ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Authenticated users can SELECT their own data
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
CREATE POLICY "Users can read own data"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 3. Authenticated users can INSERT their own record (CRITICAL FOR LOGIN!)
DROP POLICY IF EXISTS "Users can insert own record" ON public.users;
CREATE POLICY "Users can insert own record"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- 4. Authenticated users can UPDATE their own data
DROP POLICY IF EXISTS "Users can update own record" ON public.users;
CREATE POLICY "Users can update own record"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 5. Anon can read for public profile display
DROP POLICY IF EXISTS "Allow anon to read" ON public.users;
CREATE POLICY "Allow anon to read"
  ON public.users
  FOR SELECT
  TO anon
  USING (true);

-- Verify policies
SELECT policyname, cmd, roles::text 
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public'
ORDER BY policyname;

