-- Supabase RLS Policies for Onboarding Access
-- Run this in Supabase SQL Editor

-- Enable RLS on talent_profiles
ALTER TABLE talent_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (ignore errors if they don't exist)
DROP POLICY IF EXISTS "Allow anonymous onboarding token access" ON talent_profiles;
DROP POLICY IF EXISTS "Allow authenticated access" ON talent_profiles;

-- Create policy to allow anonymous access for onboarding token lookups
CREATE POLICY "Allow anonymous onboarding token access" ON talent_profiles
FOR SELECT 
TO anon
USING (onboarding_token IS NOT NULL AND onboarding_completed = false);

-- Create policy to allow authenticated access for all talent profiles
CREATE POLICY "Allow authenticated access" ON talent_profiles
FOR ALL 
TO authenticated
USING (true);

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing user policies if they exist
DROP POLICY IF EXISTS "Allow user creation during onboarding" ON users;
DROP POLICY IF EXISTS "Users can access own data" ON users;
DROP POLICY IF EXISTS "Allow talent self-update" ON users;

-- Allow anonymous access to create users during onboarding
CREATE POLICY "Allow user creation during onboarding" ON users
FOR INSERT 
TO anon
WITH CHECK (user_type = 'talent');

-- Allow authenticated users to access their own data
CREATE POLICY "Users can access own data" ON users
FOR ALL 
TO authenticated
USING (auth.uid() = id);

-- Allow talent to update their own user data during onboarding
CREATE POLICY "Allow talent self-update" ON users
FOR UPDATE 
TO authenticated
USING (auth.uid() = id AND user_type = 'talent');
