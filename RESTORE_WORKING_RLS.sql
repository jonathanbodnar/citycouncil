-- RESTORE the RLS policies that were working before
-- These allow BOTH the trigger (runs as authenticated) AND our code to insert

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "Allow system user creation" ON public.users;
DROP POLICY IF EXISTS "Allow system insert for auth triggers" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated user self-insert" ON public.users;
DROP POLICY IF EXISTS "Allow user creation during onboarding" ON public.users;
DROP POLICY IF EXISTS "Users can access own data" ON public.users;
DROP POLICY IF EXISTS "Allow talent self-update" ON public.users;
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Allow users to update own record" ON public.users;

-- Recreate the policies that were working
-- 1. Allow anonymous INSERT for onboarding (before auth)
CREATE POLICY "Allow user creation during onboarding" ON public.users
FOR INSERT 
TO anon
WITH CHECK (user_type = 'talent');

-- 2. Allow authenticated ALL access to own data (includes INSERT from trigger)
CREATE POLICY "Users can access own data" ON public.users
FOR ALL 
TO authenticated
USING (auth.uid() = id OR auth.uid() IS NULL);

-- 3. Allow talent to update their own user data
CREATE POLICY "Allow talent self-update" ON public.users
FOR UPDATE 
TO authenticated
USING (auth.uid() = id AND user_type = 'talent');

-- Verify policies
SELECT 
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users'
AND schemaname = 'public'
ORDER BY policyname;

