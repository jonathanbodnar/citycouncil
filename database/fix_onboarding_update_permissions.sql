-- Fix RLS policies to allow onboarding users to update their own talent profiles
-- This ensures onboarding users have the same permissions as regular talent users

-- Drop existing policies that might be blocking updates
DROP POLICY IF EXISTS "Allow talent to update own profile" ON talent_profiles;
DROP POLICY IF EXISTS "Allow onboarding talent updates" ON talent_profiles;

-- Create comprehensive policy for talent profile updates
CREATE POLICY "Allow talent to update own profile" ON talent_profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow talent to view their own profile
DROP POLICY IF EXISTS "Allow talent to view own profile" ON talent_profiles;
CREATE POLICY "Allow talent to view own profile" ON talent_profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow public viewing of active talent profiles
DROP POLICY IF EXISTS "Allow public to view active talent" ON talent_profiles;
CREATE POLICY "Allow public to view active talent" ON talent_profiles
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Allow anonymous access for onboarding token lookup
DROP POLICY IF EXISTS "Allow anonymous onboarding access" ON talent_profiles;
CREATE POLICY "Allow anonymous onboarding access" ON talent_profiles
FOR SELECT
TO anon
USING (onboarding_token IS NOT NULL AND onboarding_completed = false);

-- Ensure users can update their own records
DROP POLICY IF EXISTS "Allow users to update own record" ON users;
CREATE POLICY "Allow users to update own record" ON users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());
