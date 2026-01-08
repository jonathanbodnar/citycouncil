-- FIX USERS TABLE RLS FOR LOGIN
-- The issue: authenticated users can't INSERT their own record when profile doesn't exist
-- This happens when auth.users exists but public.users doesn't (e.g., after trigger failure)

-- First, check current policies
SELECT policyname, cmd, roles::text 
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public';

-- The INSERT policy already exists, so just verify all policies are correct
-- Run this to see what's actually there:
SELECT 
  policyname,
  cmd,
  roles::text,
  qual::text as using_clause,
  with_check::text as with_check_clause
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public'
ORDER BY cmd, policyname;

