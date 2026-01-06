-- Fix RLS policies for bio_settings table
-- The issue: Updates return empty array, meaning RLS is blocking the update

-- First, check current policies
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
WHERE tablename = 'bio_settings';

-- Check if RLS is enabled
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'bio_settings';

-- Option 1: Add/Update policy to allow users to update their own bio_settings
-- The policy should check that the talent_id matches a talent_profile owned by the current user

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Users can update their own bio settings" ON bio_settings;

-- Create new update policy
CREATE POLICY "Users can update their own bio settings" ON bio_settings
    FOR UPDATE
    USING (
        talent_id IN (
            SELECT id FROM talent_profiles WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        talent_id IN (
            SELECT id FROM talent_profiles WHERE user_id = auth.uid()
        )
    );

-- Also ensure SELECT policy exists
DROP POLICY IF EXISTS "Users can view their own bio settings" ON bio_settings;

CREATE POLICY "Users can view their own bio settings" ON bio_settings
    FOR SELECT
    USING (
        talent_id IN (
            SELECT id FROM talent_profiles WHERE user_id = auth.uid()
        )
        OR is_published = true  -- Allow public to view published bio pages
    );

-- Ensure INSERT policy exists
DROP POLICY IF EXISTS "Users can insert their own bio settings" ON bio_settings;

CREATE POLICY "Users can insert their own bio settings" ON bio_settings
    FOR INSERT
    WITH CHECK (
        talent_id IN (
            SELECT id FROM talent_profiles WHERE user_id = auth.uid()
        )
    );

-- Verify the policies were created
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'bio_settings';

