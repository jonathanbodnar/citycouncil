-- FIX BIO SETTINGS RLS - VERSION 2
-- The update is returning empty array, meaning RLS is blocking

-- First, let's check what policies exist
SELECT policyname, cmd, qual::text, with_check::text 
FROM pg_policies 
WHERE tablename = 'bio_settings';

-- Check if RLS is enabled
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'bio_settings';

-- Let's see the actual data to understand the relationship
SELECT 
    bs.id as bio_settings_id,
    bs.talent_id,
    tp.id as talent_profile_id,
    tp.user_id,
    tp.username
FROM bio_settings bs
JOIN talent_profiles tp ON bs.talent_id = tp.id
WHERE tp.username = 'jonathanbodnar';

-- OPTION 1: Drop all existing policies and create simple ones
DROP POLICY IF EXISTS "Users can update their own bio settings" ON bio_settings;
DROP POLICY IF EXISTS "Users can view their own bio settings" ON bio_settings;
DROP POLICY IF EXISTS "Users can insert their own bio settings" ON bio_settings;
DROP POLICY IF EXISTS "Anyone can view published bio settings" ON bio_settings;
DROP POLICY IF EXISTS "bio_settings_select_policy" ON bio_settings;
DROP POLICY IF EXISTS "bio_settings_update_policy" ON bio_settings;
DROP POLICY IF EXISTS "bio_settings_insert_policy" ON bio_settings;
DROP POLICY IF EXISTS "Enable read access for all users" ON bio_settings;
DROP POLICY IF EXISTS "Enable update for users based on talent_id" ON bio_settings;

-- Create simple, permissive policies
-- SELECT: Anyone can read (for public bio pages)
CREATE POLICY "bio_settings_select" ON bio_settings
    FOR SELECT
    USING (true);

-- UPDATE: Users can update where talent_id matches their talent_profile
CREATE POLICY "bio_settings_update" ON bio_settings
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM talent_profiles 
            WHERE talent_profiles.id = bio_settings.talent_id 
            AND talent_profiles.user_id = auth.uid()
        )
    );

-- INSERT: Users can insert for their own talent_profile
CREATE POLICY "bio_settings_insert" ON bio_settings
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM talent_profiles 
            WHERE talent_profiles.id = bio_settings.talent_id 
            AND talent_profiles.user_id = auth.uid()
        )
    );

-- DELETE: Users can delete their own
CREATE POLICY "bio_settings_delete" ON bio_settings
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM talent_profiles 
            WHERE talent_profiles.id = bio_settings.talent_id 
            AND talent_profiles.user_id = auth.uid()
        )
    );

-- Verify policies
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'bio_settings';

-- OPTION 2 (NUCLEAR): If policies still don't work, disable RLS temporarily
-- WARNING: Only use this for testing, re-enable after fixing
-- ALTER TABLE bio_settings DISABLE ROW LEVEL SECURITY;

-- To re-enable:
-- ALTER TABLE bio_settings ENABLE ROW LEVEL SECURITY;

