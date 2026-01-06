-- FIX SOCIAL_ACCOUNTS RLS
-- Similar to bio_settings, the social_accounts table likely has RLS blocking updates

-- Check current policies
SELECT policyname, cmd, qual::text, with_check::text 
FROM pg_policies 
WHERE tablename = 'social_accounts';

-- Check if RLS is enabled
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'social_accounts';

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their own social accounts" ON social_accounts;
DROP POLICY IF EXISTS "Users can update their own social accounts" ON social_accounts;
DROP POLICY IF EXISTS "Users can insert their own social accounts" ON social_accounts;
DROP POLICY IF EXISTS "Users can delete their own social accounts" ON social_accounts;
DROP POLICY IF EXISTS "social_accounts_select" ON social_accounts;
DROP POLICY IF EXISTS "social_accounts_update" ON social_accounts;
DROP POLICY IF EXISTS "social_accounts_insert" ON social_accounts;
DROP POLICY IF EXISTS "social_accounts_delete" ON social_accounts;
DROP POLICY IF EXISTS "Enable read access for all users" ON social_accounts;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON social_accounts;
DROP POLICY IF EXISTS "Enable update for users based on talent_id" ON social_accounts;
DROP POLICY IF EXISTS "Enable delete for users based on talent_id" ON social_accounts;

-- Create new policies
-- SELECT: Anyone can read (for public bio pages)
CREATE POLICY "social_accounts_select" ON social_accounts
    FOR SELECT
    USING (true);

-- INSERT: Authenticated users can insert for any talent (admin needs this)
-- For more security, you could restrict to only their own talent_profile
CREATE POLICY "social_accounts_insert" ON social_accounts
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- UPDATE: Authenticated users can update
CREATE POLICY "social_accounts_update" ON social_accounts
    FOR UPDATE
    USING (auth.role() = 'authenticated');

-- DELETE: Authenticated users can delete
CREATE POLICY "social_accounts_delete" ON social_accounts
    FOR DELETE
    USING (auth.role() = 'authenticated');

-- Verify policies
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'social_accounts';

-- Also check if there are any existing social accounts for a specific talent
-- Replace 'jonathanbodnar' with the username you're testing
SELECT sa.*, tp.username 
FROM social_accounts sa
JOIN talent_profiles tp ON sa.talent_id = tp.id
WHERE tp.username = 'jonathanbodnar';

