-- Fix onboarding access issues
-- Allow anonymous access to talent_profiles for onboarding token lookups

-- Enable RLS on talent_profiles if not already enabled
ALTER TABLE talent_profiles ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous access for onboarding token lookups
CREATE POLICY IF NOT EXISTS "Allow anonymous onboarding token access" ON talent_profiles
FOR SELECT 
TO anon
USING (onboarding_token IS NOT NULL AND onboarding_completed = false);

-- Create policy to allow authenticated access for all talent profiles
CREATE POLICY IF NOT EXISTS "Allow authenticated access" ON talent_profiles
FOR ALL 
TO authenticated
USING (true);

-- Also ensure the users table allows the necessary access for onboarding
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access to create users during onboarding
CREATE POLICY IF NOT EXISTS "Allow user creation during onboarding" ON users
FOR INSERT 
TO anon
WITH CHECK (user_type = 'talent');

-- Allow authenticated users to access their own data
CREATE POLICY IF NOT EXISTS "Users can access own data" ON users
FOR ALL 
TO authenticated
USING (auth.uid() = id);

-- Allow talent to update their own user data during onboarding
CREATE POLICY IF NOT EXISTS "Allow talent self-update" ON users
FOR UPDATE 
TO authenticated
USING (auth.uid() = id AND user_type = 'talent');
