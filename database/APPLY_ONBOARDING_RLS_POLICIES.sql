-- APPLY RLS POLICIES FOR /start TALENT ONBOARDING
-- Run this in Supabase SQL Editor to enable self-registration
-- These policies allow new talent to:
-- 1. Create their user record
-- 2. Create their talent profile
-- 3. Update their own profile during onboarding
-- 4. Upload promo videos (via Wasabi - no DB policy needed)

-- =====================================================
-- STEP 1: TALENT PROFILES TABLE
-- =====================================================

-- Enable RLS on talent_profiles if not already enabled
ALTER TABLE talent_profiles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to INSERT their own talent profile
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

-- =====================================================
-- STEP 2: USERS TABLE
-- =====================================================

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to INSERT their own user record
DROP POLICY IF EXISTS "Users can create their own user record" ON users;
CREATE POLICY "Users can create their own user record"
ON users
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Allow authenticated users to UPDATE their own user record
DROP POLICY IF EXISTS "Users can update their own user record" ON users;
CREATE POLICY "Users can update their own user record"
ON users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Allow authenticated users to SELECT their own user record
DROP POLICY IF EXISTS "Users can view their own user record" ON users;
CREATE POLICY "Users can view their own user record"
ON users
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- =====================================================
-- STEP 3: APP_SETTINGS TABLE (for reading platform settings)
-- =====================================================

-- Allow public/authenticated to read app settings (for admin fee percentage, etc.)
DROP POLICY IF EXISTS "Anyone can read app settings" ON app_settings;
CREATE POLICY "Anyone can read app settings"
ON app_settings
FOR SELECT
TO anon, authenticated
USING (true);

-- =====================================================
-- VERIFICATION: Check that policies were created
-- =====================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE tablename IN ('talent_profiles', 'users', 'app_settings')
ORDER BY tablename, policyname;
