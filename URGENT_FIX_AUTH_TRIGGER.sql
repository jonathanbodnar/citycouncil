-- URGENT: Fix auth.users database trigger issue
-- The error "Database error saving new user" is coming from signUp(),
-- which means a trigger or RLS on auth.users is failing

-- Step 1: Check what triggers exist on auth.users
-- Run this first to see what's there:
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users'
AND event_object_schema = 'auth';

-- Step 2: Check if there's a trigger trying to insert into public.users
-- This is the most common issue - a trigger that automatically creates
-- a public.users record when auth.users is created, but it's failing due to RLS

-- Step 3: Temporarily disable the problematic trigger
-- (Replace 'trigger_name_here' with actual trigger name from Step 1)
-- ALTER TABLE auth.users DISABLE TRIGGER trigger_name_here;

-- Step 4: Alternative - ensure public.users has correct RLS for INSERT from triggers
-- Triggers run as the POSTGRES role, not as authenticated users
-- So we need a policy that allows the system to insert

DROP POLICY IF EXISTS "Allow system insert for auth triggers" ON public.users;

CREATE POLICY "Allow system insert for auth triggers" ON public.users
FOR INSERT
TO authenticated, anon, postgres
WITH CHECK (true);

-- Step 5: Also ensure authenticated users can insert their own records
DROP POLICY IF EXISTS "Allow authenticated user self-insert" ON public.users;

CREATE POLICY "Allow authenticated user self-insert" ON public.users
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);

-- Step 6: Allow SELECT for authenticated users on their own records
DROP POLICY IF EXISTS "Users can read own data" ON public.users;

CREATE POLICY "Users can read own data" ON public.users
FOR SELECT
TO authenticated, anon
USING (auth.uid() = id OR auth.uid() IS NULL);

-- Step 7: Verify policies
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
AND schemaname = 'public'
ORDER BY policyname;

