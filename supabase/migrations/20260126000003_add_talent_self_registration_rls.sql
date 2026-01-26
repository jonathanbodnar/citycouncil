-- Migration: Add RLS policies for talent self-registration
-- Description: Allows authenticated users to create and manage their own talent profiles

-- Enable RLS on talent_profiles if not already enabled
ALTER TABLE talent_profiles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to INSERT their own talent profile
-- This is needed for the self-registration onboarding flow
DROP POLICY IF EXISTS "Users can create their own talent profile" ON talent_profiles;
CREATE POLICY "Users can create their own talent profile"
ON talent_profiles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Allow authenticated users to UPDATE their own talent profile
DROP POLICY IF EXISTS "Users can update their own talent profile" ON talent_profiles;
CREATE POLICY "Users can update their own talent profile"
ON talent_profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow authenticated users to SELECT their own talent profile
DROP POLICY IF EXISTS "Users can view their own talent profile" ON talent_profiles;
CREATE POLICY "Users can view their own talent profile"
ON talent_profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow public to view active talent profiles (for homepage, profile pages)
DROP POLICY IF EXISTS "Public can view active talent profiles" ON talent_profiles;
CREATE POLICY "Public can view active talent profiles"
ON talent_profiles
FOR SELECT
TO anon
USING (is_active = true);

-- Also need RLS for users table for self-registration
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to INSERT/UPDATE their own user record
DROP POLICY IF EXISTS "Users can create their own user record" ON users;
CREATE POLICY "Users can create their own user record"
ON users
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own user record" ON users;
CREATE POLICY "Users can update their own user record"
ON users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own user record" ON users;
CREATE POLICY "Users can view their own user record"
ON users
FOR SELECT
TO authenticated
USING (id = auth.uid());
